-- notifications: 通知の行(アプリ内の通知一覧と、プッシュ通知の元)。
-- 行は sessions の変化に応じてトリガーが作る。本人は読む・既読にするだけ。
create table public.notifications (
  id           uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references auth.users (id) on delete cascade,
  type         text not null check (type in (
                 'session_request_received',
                 'session_request_approved',
                 'session_request_rejected',
                 'session_completed',
                 'review_request',
                 'session_auto_completed'
               )),
  session_id   uuid references public.sessions (id) on delete cascade,
  is_read      boolean not null default false,
  created_at   timestamptz not null default now()
);

comment on table  public.notifications              is '通知(アプリ内通知とプッシュ通知の元)';
comment on column public.notifications.id           is '通知ID';
comment on column public.notifications.recipient_id is '通知の受信者ユーザーID';
comment on column public.notifications.type         is '通知の種類(session_request_received / session_request_approved / session_request_rejected / session_completed / review_request / session_auto_completed)';
comment on column public.notifications.session_id   is '紐づくセッションID。掲示板経由かどうかは sessions.post_id で判定する';
comment on column public.notifications.is_read      is '既読フラグ。既読日時は持たない';
comment on column public.notifications.created_at   is '通知作成日時(=発生日時)';

create index notifications_recipient_id_idx     on public.notifications (recipient_id, created_at desc);
create index notifications_recipient_unread_idx on public.notifications (recipient_id) where is_read = false;
-- セッション削除時の連鎖削除用
create index notifications_session_id_idx       on public.notifications (session_id) where session_id is not null;

alter table public.notifications enable row level security;

revoke all on public.notifications from anon, authenticated;
grant select           on public.notifications to authenticated;
grant update (is_read) on public.notifications to authenticated;
grant all              on public.notifications to service_role;

create policy "notifications_select_own"
  on public.notifications for select
  to authenticated
  using ((select auth.uid()) = recipient_id);

create policy "notifications_update_own"
  on public.notifications for update
  to authenticated
  using      ((select auth.uid()) = recipient_id)
  with check ((select auth.uid()) = recipient_id);

-- insert / delete の GRANT とポリシーは設けない(通知は security definer のトリガーが作る)