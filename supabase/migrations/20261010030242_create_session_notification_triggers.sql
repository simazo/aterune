-- sessions の変化に応じて notifications の行を作るトリガー。
-- 外部への送信(プッシュ通知の Webhook)は別途、Vault + pg_net で作る。

-- 申込みが作られたら、申込まれた側に通知
create function public.notify_session_request_received()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.notifications (recipient_id, type, session_id)
  values (new.recipient_id, 'session_request_received', new.id);
  return new;
end;
$$;

-- status の変化に応じて通知(期限切れ pending → expired では通知しない)
create function public.notify_session_status_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.status = 'pending' and new.status = 'active' then
    insert into public.notifications (recipient_id, type, session_id)
    values (new.applicant_id, 'session_request_approved', new.id);

  elsif old.status = 'pending' and new.status = 'rejected' then
    insert into public.notifications (recipient_id, type, session_id)
    values (new.applicant_id, 'session_request_rejected', new.id);

  elsif old.status = 'active' and new.status = 'completed' then
    insert into public.notifications (recipient_id, type, session_id)
    values (new.teller_id, 'session_completed', new.id);

    insert into public.notifications (recipient_id, type, session_id)
    values (new.consultant_id, 'review_request', new.id);

  elsif old.status = 'active' and new.status = 'auto_completed' then
    insert into public.notifications (recipient_id, type, session_id)
    values (new.teller_id, 'session_auto_completed', new.id);

    insert into public.notifications (recipient_id, type, session_id)
    values (new.consultant_id, 'session_auto_completed', new.id);
  end if;

  return new;
end;
$$;

revoke all on function public.notify_session_request_received() from public, anon, authenticated;
revoke all on function public.notify_session_status_change()    from public, anon, authenticated;

create trigger sessions_notify_request_received
  after insert on public.sessions
  for each row execute function public.notify_session_request_received();

create trigger sessions_notify_status_change
  after update of status on public.sessions
  for each row execute function public.notify_session_status_change();