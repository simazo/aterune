-- sessions: 相談者と占い師のやり取りの単位(申込み → 承認 → 完了)。
-- 役割はセッションごとに決まる(占い師同士の相互相談があるため)。
--   initiated_by = 'consultant': 相談者から申し込む(applicant = consultant)
--   initiated_by = 'teller'    : 占い師から掲示板投稿へ応募する(applicant = teller)
create table public.sessions (
  id                uuid primary key default gen_random_uuid(),
  applicant_id      uuid not null references auth.users (id) on delete cascade,
  recipient_id      uuid not null references auth.users (id) on delete cascade,
  consultant_id     uuid not null references auth.users (id) on delete cascade,
  teller_id         uuid not null references public.teller_profiles (profile_id),
  initiated_by      text not null,
  status            text not null default 'pending',
  category          text,
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
  constraint sessions_no_self_session
    check (applicant_id <> recipient_id),
  constraint sessions_consultant_teller_match
    check ((consultant_id = applicant_id and teller_id = recipient_id)
        or (consultant_id = recipient_id and teller_id = applicant_id)),
  constraint sessions_initiated_by_role_match
    check ((initiated_by = 'consultant' and applicant_id = consultant_id)
        or (initiated_by = 'teller'     and applicant_id = teller_id))
);

comment on table  public.sessions                   is '相談者と占い師のやり取りの単位';
comment on column public.sessions.id                is 'セッションID';
comment on column public.sessions.applicant_id      is '申込んだ側のユーザーID';
comment on column public.sessions.recipient_id      is '申込まれた側のユーザーID';
comment on column public.sessions.consultant_id     is '相談者側のユーザーID(申込みの方向に関わらず常に相談者)';
comment on column public.sessions.teller_id         is '占い師側のユーザーID(申込みの方向に関わらず常に占い師)';
comment on column public.sessions.initiated_by      is '申込みの起点(consultant=相談者から、teller=占い師から(掲示板投稿への応募))';
comment on column public.sessions.status            is 'pending=承認待ち / active=進行中 / completed=相談者の完了操作 / auto_completed=相談者側の無操作による自動完了 / rejected=拒否 / expired=申込みの期限切れ';
comment on column public.sessions.category          is '相談カテゴリ(掲示板経由の場合は投稿からコピー)';
comment on column public.sessions.concern           is '悩みの内容(掲示板経由の場合は投稿からコピー)';
comment on column public.sessions.post_id           is '掲示板経由の場合の投稿ID。ストア経由はNULL。投稿削除時はNULL';
comment on column public.sessions.applicant_message is '申込み時のひとこと(任意)';
comment on column public.sessions.completed_at      is '完了日時(completed / auto_completed への遷移時にトリガーが設定)';
comment on column public.sessions.last_activity_at  is '相談者側の最終操作日時(自動完了の判定に使用。messages 作成時のトリガーで更新)';
comment on column public.sessions.expires_at        is 'pending の有効期限(作成から48時間)';

-- 索引
create index sessions_applicant_id_idx  on public.sessions (applicant_id);
create index sessions_recipient_id_idx  on public.sessions (recipient_id);
create index sessions_consultant_id_idx on public.sessions (consultant_id);
create index sessions_teller_id_idx     on public.sessions (teller_id);
create index sessions_post_id_idx       on public.sessions (post_id)          where post_id is not null;
create index sessions_expires_at_idx    on public.sessions (expires_at)       where status = 'pending';
create index sessions_last_activity_idx on public.sessions (last_activity_at) where status = 'active';

-- ============================================================
-- トリガー関数
-- ============================================================

-- 掲示板経由の整合性:
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

-- 掲示板経由なら、投稿の category / concern をセッションにコピーする
create function public.copy_post_content_to_session()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.post_id is not null then
    select category, concern into new.category, new.concern
      from public.consultation_posts
     where id = new.post_id;
  end if;
  return new;
end;
$$;

-- status 遷移のガード。auth.uid() が null の呼び出し(service_role / 定期処理)はシステム扱い。
--   pending → active / rejected : 申し込まれた側(承認は期限内のみ)
--   pending → expired           : システムのみ
--   active  → completed         : 相談者のみ
--   active  → auto_completed    : システムのみ
--   それ以外(終了済みからの遷移を含む)は不可
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

  elsif old.status = 'pending' and new.status = 'rejected' then
    if v_uid is not null and v_uid <> new.recipient_id then
      raise exception 'only the recipient can reject a session request';
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

-- トリガー専用関数: Supabase が anon / authenticated に自動付与する権限も外す
revoke all on function public.check_session_post()           from public, anon, authenticated;
revoke all on function public.copy_post_content_to_session() from public, anon, authenticated;
revoke all on function public.guard_session_status_change()  from public, anon, authenticated;
revoke all on function public.sync_post_status()             from public, anon, authenticated;

-- ============================================================
-- トリガー
-- ============================================================
create trigger sessions_check_post
  before insert or update of post_id, consultant_id, initiated_by on public.sessions
  for each row execute function public.check_session_post();

create trigger sessions_copy_post_content
  before insert on public.sessions
  for each row execute function public.copy_post_content_to_session();

create trigger sessions_guard_status_change
  before update of status on public.sessions
  for each row execute function public.guard_session_status_change();

create trigger set_updated_at
  before update on public.sessions
  for each row execute function public.set_updated_at();

create trigger sessions_sync_post_status
  after insert or update of status on public.sessions
  for each row execute function public.sync_post_status();

-- ============================================================
-- RLS・GRANT
-- ============================================================
alter table public.sessions enable row level security;

revoke all on public.sessions from anon, authenticated;
grant select on public.sessions to authenticated;
grant insert (applicant_id, recipient_id, consultant_id, teller_id, initiated_by,
              category, concern, post_id, applicant_message)
  on public.sessions to authenticated;
grant update (status) on public.sessions to authenticated;
grant all on public.sessions to service_role;

create policy "sessions_select_own"
  on public.sessions for select
  to authenticated
  using ((select auth.uid()) in (applicant_id, recipient_id));

create policy "sessions_insert_own"
  on public.sessions for insert
  to authenticated
  with check ((select auth.uid()) = applicant_id);

create policy "sessions_update_own"
  on public.sessions for update
  to authenticated
  using      ((select auth.uid()) in (applicant_id, recipient_id))
  with check ((select auth.uid()) in (applicant_id, recipient_id));