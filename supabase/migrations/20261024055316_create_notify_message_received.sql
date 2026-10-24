-- メッセージが送られたら、セッションの相手(送った人ではない側)に通知を作る。
-- プッシュ送信は notifications のトリガー(send_push_notification)が行う。
-- 未読が残っていても1通ごとに通知を作る(まとめない)。
create function public.notify_message_received()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.notifications (recipient_id, type, session_id)
  select case when s.consultant_id = new.sender_id then s.teller_id else s.consultant_id end,
         'message_received',
         new.session_id
    from public.sessions s
   where s.id = new.session_id;
  return new;
end;
$$;

comment on function public.notify_message_received() is 'メッセージの相手に message_received の通知を作る(トリガー専用)';

revoke all on function public.notify_message_received() from public, anon, authenticated;

create trigger messages_notify_message_received
  after insert on public.messages
  for each row execute function public.notify_message_received();
