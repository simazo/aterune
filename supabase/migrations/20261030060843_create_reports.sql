-- reports: 不適切な言動をするユーザーを運営に知らせる通報(App Store 審査ガイドライン 1.2 の対応)。
-- 通報の対象はユーザーだけ。セッション詳細からはそのセッションの ID も残し、占い師詳細からはセッションなしで残す。
-- 利用者は自分名義の通報を insert できるだけで、読む・直す・消すことはできない(自分が出したものも)。
-- 通報されたことは相手に知らせない。運営は Supabase のダッシュボードで見て対応する。
-- 退会は論理削除で auth.users の行を消さないため、通報した人・された人が退会しても通報は残る。
create type public.report_reason as enum (
  'inappropriate_content',
  'harassment',
  'spam',
  'external_solicitation',
  'impersonation',
  'other'
);

comment on type public.report_reason is
  '通報の理由(inappropriate_content=不適切な内容 / harassment=嫌がらせ・誹謗中傷 / spam=スパム・宣伝 / external_solicitation=外部サービスへの誘導 / impersonation=なりすまし / other=その他)';

create table public.reports (
  id               uuid primary key default gen_random_uuid(),
  reporter_id      uuid not null references auth.users (id) on delete cascade,
  reported_user_id uuid not null references auth.users (id) on delete cascade,
  session_id       uuid references public.sessions (id) on delete set null,
  reason           public.report_reason not null,
  detail           text,
  created_at       timestamptz not null default now(),
  constraint reports_not_self_check check (reporter_id <> reported_user_id),
  constraint reports_detail_length_check check (char_length(detail) <= 500)
);

comment on table  public.reports                  is 'ユーザーの通報(運営がダッシュボードで見て対応する)';
comment on column public.reports.id               is '通報ID';
comment on column public.reports.reporter_id      is '通報したユーザーID';
comment on column public.reports.reported_user_id is '通報されたユーザーID';
comment on column public.reports.session_id       is '通報のもとになったセッションのID(セッション詳細から通報したとき。占い師詳細からはNULL、セッションの削除時もNULL)';
comment on column public.reports.reason           is '通報の理由';
comment on column public.reports.detail           is '詳しい内容(任意。500文字まで)';
comment on column public.reports.created_at       is '通報した日時';

-- 運営が通報されたユーザーごとに確かめるための索引
-- (reporter_id・session_id は、利用者からの読み取りが無く、件数も少ない想定のため付けない。
--  ユーザーの物理削除・セッションの削除のときは全件を見るが、どちらもまれなため。重くなったら足す)
create index reports_reported_user_id_idx on public.reports (reported_user_id);

alter table public.reports enable row level security;

revoke all on public.reports from anon, authenticated;
grant insert on public.reports to authenticated;
grant all    on public.reports to service_role;

create policy reports_insert_own
  on public.reports for insert
  to authenticated
  with check ((select auth.uid()) = reporter_id);

-- session_id があるときは、通報した人がそのセッションの当事者で、通報される人がその相手であることを確かめる。
-- 当事者は sessions_select_own で自分のセッションを読めるため、呼び出し元の権限で動けばよく security definer は付けない
-- (当事者でなければ行が読めず、見つからないので弾ける)
create function public.check_report_session()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_consultant_id uuid;
  v_teller_id     uuid;
begin
  if new.session_id is null then
    return new;
  end if;

  select consultant_id, teller_id
    into v_consultant_id, v_teller_id
    from public.sessions
   where id = new.session_id;

  if not found or new.reporter_id not in (v_consultant_id, v_teller_id) then
    raise exception 'the reporter is not a party of the session';
  end if;

  if new.reported_user_id not in (v_consultant_id, v_teller_id) then
    raise exception 'the reported user is not the other party of the session';
  end if;

  return new;
end;
$$;

comment on function public.check_report_session() is
  '通報に付けたセッションの当事者が、通報した人とされた人であることを確かめる';

create trigger reports_check_session
  before insert on public.reports
  for each row execute function public.check_report_session();
