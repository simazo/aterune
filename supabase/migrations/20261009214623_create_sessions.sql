-- sessions: 相談者と占い師のやり取りの単位(申込み → 承認 → 完了)。
-- 役割はセッションごとに決まる(占い師同士の相互相談があるため)。
--   initiated_by = 'consultant': 相談者から申し込む(applicant = consultant)
--   initiated_by = 'teller'    : 占い師からお悩み投稿へ応募する(applicant = teller)
create table public.sessions (
  id                uuid primary key default gen_random_uuid(),
  applicant_id      uuid not null references auth.users (id) on delete cascade,
  recipient_id      uuid not null references auth.users (id) on delete cascade,
  consultant_id     uuid not null references auth.users (id) on delete cascade,
  teller_id         uuid not null references public.teller_profiles (profile_id),
  initiated_by      text not null,
  status            text not null default 'pending',
  concern_tag_id    uuid references public.tags (id),
  concern           text not null,
  post_id           uuid references public.consultation_posts (id) on delete set null,
  applicant_message text,
  completed_at      timestamptz,
  last_activity_at  timestamptz not null default now(),
  expires_at        timestamptz not null default now() + interval '48 hours',
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  constraint sessions_status_check
    check (status in ('pending', 'active', 'completed', 'auto_completed', 'rejected', 'expired')),
  constraint sessions_initiated_by_check
    check (initiated_by in ('consultant', 'teller')),
  constraint sessions_no_self_session_check
    check (applicant_id <> recipient_id),
  constraint sessions_consultant_teller_match_check
    check ((consultant_id = applicant_id and teller_id = recipient_id)
        or (consultant_id = recipient_id and teller_id = applicant_id)),
  constraint sessions_initiated_by_role_match_check
    check ((initiated_by = 'consultant' and applicant_id = consultant_id)
        or (initiated_by = 'teller'     and applicant_id = teller_id)),
  constraint sessions_concern_length_check
    check (char_length(concern) <= 1000),
  constraint sessions_applicant_message_length_check
    check (char_length(applicant_message) <= 100)
);

comment on table  public.sessions                   is '相談者と占い師のやり取りの単位';
comment on column public.sessions.id                is 'セッションID';
comment on column public.sessions.applicant_id      is '申込んだ側のユーザーID';
comment on column public.sessions.recipient_id      is '申込まれた側のユーザーID';
comment on column public.sessions.consultant_id     is '相談者側のユーザーID(申込みの方向に関わらず常に相談者)';
comment on column public.sessions.teller_id         is '占い師側のユーザーID(申込みの方向に関わらず常に占い師)';
comment on column public.sessions.initiated_by      is '申込みの起点(consultant=相談者から、teller=占い師から(お悩み投稿への応募))';
comment on column public.sessions.status            is 'pending=承認待ち / active=進行中 / completed=相談者の完了操作 / auto_completed=相談者側の無操作による自動完了 / rejected=拒否 / expired=申込みの期限切れ';
comment on column public.sessions.concern_tag_id    is '悩みタグのID(お悩み投稿経由の場合は投稿からコピー。相談者からの申込みでは NULL)';
comment on column public.sessions.concern           is '悩みの内容(お悩み投稿経由の場合は投稿からコピー。1000文字まで)';
comment on column public.sessions.post_id           is 'お悩み投稿経由の場合の投稿ID。それ以外と投稿削除時はNULL';
comment on column public.sessions.applicant_message is '申込み時のひとこと(任意。100文字まで)';
comment on column public.sessions.completed_at      is '完了日時(completed / auto_completed への遷移時にトリガーが設定)';
comment on column public.sessions.last_activity_at  is '相談者側の最終操作日時(自動完了の判定に使用。承認時と、相談者の messages 作成時にトリガーで更新)';
comment on column public.sessions.expires_at        is 'pending の有効期限(作成から48時間)';

-- 索引
create index sessions_applicant_id_idx  on public.sessions (applicant_id);
create index sessions_recipient_id_idx  on public.sessions (recipient_id);
create index sessions_consultant_id_idx on public.sessions (consultant_id);
create index sessions_teller_id_idx     on public.sessions (teller_id);
create index sessions_post_id_idx       on public.sessions (post_id)          where post_id is not null;
create index sessions_concern_tag_id_idx on public.sessions (concern_tag_id)  where concern_tag_id is not null;

-- 同じ投稿へは、占い師1人につき1回だけ応募できる(拒否・期限切れのあとも再応募させない)
create unique index sessions_post_id_teller_id_key on public.sessions (post_id, teller_id) where post_id is not null;
create index sessions_expires_at_idx    on public.sessions (expires_at)       where status = 'pending';
create index sessions_last_activity_idx on public.sessions (last_activity_at) where status = 'active';

-- ============================================================
-- トリガー関数
-- ============================================================

-- お悩み投稿経由の整合性:
--   ・占い師からの申込みは、お悩み投稿への応募だけ(作成時のみ確かめる。投稿の削除で post_id が NULL になる更新は通す)
--   ・占い師から投稿者への応募であること
--   ・相談者側が投稿者本人であること
--   ・閉じた投稿には新規に応募できないこと
create function public.check_session_post()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner  uuid;
  v_status text;
begin
  if tg_op = 'INSERT' and new.initiated_by = 'teller' and new.post_id is null then
    raise exception 'a teller can only apply through a post';
  end if;

  if new.post_id is null then
    return new;
  end if;

  select consultant_id, status into v_owner, v_status
    from public.consultation_posts
   where id = new.post_id;

  if not found then
    return new; -- 存在しない post_id は外部キーが弾く
  end if;

  if new.initiated_by <> 'teller' or new.consultant_id <> v_owner then
    raise exception 'a post session must be initiated by a teller toward the post owner';
  end if;

  if tg_op = 'INSERT' and v_status = 'closed' then
    raise exception 'cannot apply to a closed post';
  end if;

  return new;
end;
$$;

-- 申込みのルール:
--   ・相談者からの申込みは、受付停止中の占い師にはできない
--   ・相談者からの申込みは、生年月日必須の占い師には、生年月日を登録済みの相談者だけができる
--   ・申込みの向きに関わらず、同じ相談者と占い師の間に、期限内の pending か active があれば作れない
--     (期限切れの pending は、定期処理で expired になる前でも数えない。システムからの登録も弾く)
-- 利用者は status を指定できないので、利用者の申込みは常に pending として確かめる。
-- システムが終了済みの行(completed など)を直接作る場合は申込みではないので確かめない
-- 当事者は RLS で自分の生年月日と、相手とのセッションを読めるので、security definer は付けない
create function public.check_session_request()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_is_accepting       boolean;
  v_requires_birthdate boolean;
begin
  if not (new.status = 'active' or (new.status = 'pending' and new.expires_at > now())) then
    return new;
  end if;

  if new.initiated_by = 'consultant' then
    select is_accepting, requires_birthdate into v_is_accepting, v_requires_birthdate
      from public.teller_profiles
     where profile_id = new.teller_id;

    -- 存在しない teller_id は外部キーが弾く
    if found then
      if not v_is_accepting then
        raise exception 'the teller is not accepting session requests';
      end if;

      if v_requires_birthdate and not exists (
        select 1 from public.profile_private_details
         where profile_id = new.consultant_id
           and birthdate is not null
      ) then
        raise exception 'the teller requires the consultant''s birthdate';
      end if;
    end if;
  end if;

  -- 同じ組み合わせへの同時の申込みがすり抜けないよう、組み合わせごとに順番に処理する
  perform pg_advisory_xact_lock(hashtextextended(new.consultant_id::text || ':' || new.teller_id::text, 0));

  if exists (
    select 1 from public.sessions
     where consultant_id = new.consultant_id
       and teller_id = new.teller_id
       and (status = 'active' or (status = 'pending' and expires_at > now()))
  ) then
    raise exception 'an open session already exists between the consultant and the teller';
  end if;

  return new;
end;
$$;

-- お悩み投稿経由なら、投稿の concern_tag_id / concern をセッションにコピーする
create function public.copy_post_content_to_session()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.post_id is not null then
    select concern_tag_id, concern into new.concern_tag_id, new.concern
      from public.consultation_posts
     where id = new.post_id;
  end if;
  return new;
end;
$$;

-- status 遷移のガード。auth.uid() が null の呼び出し(service_role / 定期処理)はシステム扱い。
--   pending → active / rejected : 申し込まれた側(どちらも期限内のみ)
--   pending → expired           : システムのみ
--   active  → completed         : 相談者のみ
--   active  → auto_completed    : システムのみ
--   それ以外(終了済みからの遷移を含む)は不可
-- 承認時は last_activity_at を承認時点にする(自動完了までの期間を、承認待ちの時間を含めずに数えるため)
create function public.guard_session_status_change()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if new.status is not distinct from old.status then
    return new;
  end if;

  if old.status = 'pending' and new.status = 'active' then
    if v_uid is not null and v_uid <> new.recipient_id then
      raise exception 'only the recipient can approve a session request';
    end if;
    if old.expires_at < now() then
      raise exception 'the session request has expired';
    end if;
    new.last_activity_at := now();

  elsif old.status = 'pending' and new.status = 'rejected' then
    if v_uid is not null and v_uid <> new.recipient_id then
      raise exception 'only the recipient can reject a session request';
    end if;
    -- 期限切れの pending は、定期処理が expired にするまでの間も、承認と同じく拒否できない
    if old.expires_at < now() then
      raise exception 'the session request has expired';
    end if;

  elsif old.status = 'pending' and new.status = 'expired' then
    if v_uid is not null then
      raise exception 'only the system can expire a session request';
    end if;

  elsif old.status = 'active' and new.status = 'completed' then
    if v_uid is not null and v_uid <> new.consultant_id then
      raise exception 'only the consultant can complete a session';
    end if;

  elsif old.status = 'active' and new.status = 'auto_completed' then
    if v_uid is not null then
      raise exception 'only the system can auto-complete a session';
    end if;

  else
    raise exception 'invalid session status transition: % -> %', old.status, new.status;
  end if;

  if new.status in ('completed', 'auto_completed') then
    new.completed_at := now();
  end if;

  return new;
end;
$$;

-- 投稿の status を、active なセッションの有無で open / in_progress に同期する。
-- 本人が閉じた(closed)投稿は上書きしない。
create function public.sync_post_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status text;
begin
  if new.post_id is null then
    return new;
  end if;

  select case
           when exists (
             select 1 from public.sessions s
              where s.post_id = new.post_id and s.status = 'active'
           ) then 'in_progress'
           else 'open'
         end
    into v_status;

  update public.consultation_posts
     set status = v_status
   where id = new.post_id
     and status not in ('closed', v_status);

  return new;
end;
$$;

-- 占い師の完了セッション数のキャッシュ(teller_profiles.session_count)を数え直す。
-- completed / auto_completed を数える。sessions は RLS で当事者しか読めず、
-- 検索などで他人の件数を数えられないため、キャッシュとして持つ。
-- 削除でも動かすのは、ユーザーの連鎖削除でセッションが消えた場合に備えるため。
create function public.update_teller_session_count()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_teller uuid := case when tg_op = 'DELETE' then old.teller_id else new.teller_id end;
begin
  update public.teller_profiles
     set session_count = (
       select count(*) from public.sessions
        where teller_id = v_teller
          and status in ('completed', 'auto_completed')
     )
   where profile_id = v_teller;
  return null; -- AFTER トリガーなので戻り値は使われない
end;
$$;

-- トリガー専用関数: Supabase が anon / authenticated に自動付与する権限も外す
revoke all on function public.check_session_post()           from public, anon, authenticated;
revoke all on function public.check_session_request()        from public, anon, authenticated;
revoke all on function public.copy_post_content_to_session() from public, anon, authenticated;
revoke all on function public.guard_session_status_change()  from public, anon, authenticated;
revoke all on function public.sync_post_status()             from public, anon, authenticated;
revoke all on function public.update_teller_session_count()  from public, anon, authenticated;

-- ============================================================
-- トリガー
-- ============================================================
create trigger sessions_check_post
  before insert or update of post_id, consultant_id, initiated_by on public.sessions
  for each row execute function public.check_session_post();

-- BEFORE トリガーは名前順に動くため、お悩み投稿経由の整合性(sessions_check_post)の後に確かめる
create trigger sessions_check_request
  before insert on public.sessions
  for each row execute function public.check_session_request();

create trigger sessions_copy_post_content
  before insert on public.sessions
  for each row execute function public.copy_post_content_to_session();

create trigger sessions_guard_status_change
  before update of status on public.sessions
  for each row execute function public.guard_session_status_change();

create trigger sessions_set_updated_at
  before update on public.sessions
  for each row execute function public.set_updated_at();

create trigger sessions_sync_post_status
  after insert or update of status on public.sessions
  for each row execute function public.sync_post_status();

create trigger sessions_update_teller_session_count
  after insert or update of status or delete on public.sessions
  for each row execute function public.update_teller_session_count();

-- ============================================================
-- RLS・GRANT
-- ============================================================
alter table public.sessions enable row level security;

revoke all on public.sessions from anon, authenticated;
grant select on public.sessions to authenticated;
-- concern_tag_id は投稿経由ならトリガーがコピーするので、利用者には入れさせない。
-- post_id も入れさせない(お悩み投稿への応募は apply_to_consultation_post だけ)。
-- 直接入れられると、投稿者でない相手を指定したときのエラーの有無から、匿名の投稿者を割り出せてしまうため
grant insert (applicant_id, recipient_id, consultant_id, teller_id, initiated_by,
              concern, applicant_message)
  on public.sessions to authenticated;
grant update (status) on public.sessions to authenticated;
grant all on public.sessions to service_role;

create policy sessions_select_own
  on public.sessions for select
  to authenticated
  using ((select auth.uid()) in (applicant_id, recipient_id));

create policy sessions_insert_own
  on public.sessions for insert
  to authenticated
  with check ((select auth.uid()) = applicant_id);

create policy sessions_update_own
  on public.sessions for update
  to authenticated
  using      ((select auth.uid()) in (applicant_id, recipient_id))
  with check ((select auth.uid()) in (applicant_id, recipient_id));