-- messages: セッション内のメッセージ。当事者だけが読める。active なセッションにだけ自分名義で送信できる。
-- 編集・削除はできない(update / delete の GRANT なし)。
create table public.messages (
  id         uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions (id) on delete cascade,
  sender_id  uuid not null references auth.users (id) on delete cascade,
  content    text not null check (btrim(content) <> ''),
  created_at timestamptz not null default now()
);

comment on table  public.messages            is 'セッション内のメッセージ';
comment on column public.messages.id         is 'メッセージID';
comment on column public.messages.session_id is '対象セッションID';
comment on column public.messages.sender_id  is '送信者のユーザーID';
comment on column public.messages.content    is 'メッセージ本文(空白のみは不可)';

-- セッション内を時系列で取り出す用
create index messages_session_id_idx on public.messages (session_id, created_at);

-- 相談者のメッセージ送信で、セッションの最終アクティビティを更新する。
-- 占い師の返信では更新しない(自動完了の判定は相談者側の操作が基準のため)。
create function public.update_session_last_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.sessions
     set last_activity_at = now()
   where id = new.session_id
     and consultant_id = new.sender_id;
  return new;
end;
$$;

revoke all on function public.update_session_last_activity() from public, anon, authenticated;

create trigger messages_update_last_activity
  after insert on public.messages
  for each row execute function public.update_session_last_activity();

alter table public.messages enable row level security;

revoke all on public.messages from anon, authenticated;
grant select                                  on public.messages to authenticated;
grant insert (session_id, sender_id, content) on public.messages to authenticated;
grant all                                     on public.messages to service_role;

create policy "messages_select_own"
  on public.messages for select
  to authenticated
  using (
    exists (
      select 1 from public.sessions s
       where s.id = messages.session_id
         and (select auth.uid()) in (s.applicant_id, s.recipient_id)
    )
  );

create policy "messages_insert_own"
  on public.messages for insert
  to authenticated
  with check (
    sender_id = (select auth.uid())
    and exists (
      select 1 from public.sessions s
       where s.id = messages.session_id
         and (select auth.uid()) in (s.applicant_id, s.recipient_id)
         and s.status = 'active'
    )
  );