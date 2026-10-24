-- notifications に行が入ったら、Edge Function send-push を呼んでプッシュ通知を送る。
-- 呼び出しは pg_net で非同期に積むだけなので、送信先の応答の成否では通知の行の作成は止まらない。
-- ただし積む処理(net.http_post)自体の例外は握りつぶさない(設定の誤りに気づけるように)。
-- 宛先と共有シークレットは Vault から読む(マイグレーションに値を書かないため)。
--   project_url      : プロジェクトの URL(例: https://<ref>.supabase.co)
--   send_push_secret : Edge Function と共有するシークレット(Edge Function の secrets の SEND_PUSH_SECRET と同じ値)
-- どちらかが無い環境(ローカルなど)では送信を飛ばす。
create function public.send_push_notification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_project_url text;
  v_secret      text;
begin
  select decrypted_secret into v_project_url
    from vault.decrypted_secrets
   where name = 'project_url';

  select decrypted_secret into v_secret
    from vault.decrypted_secrets
   where name = 'send_push_secret';

  if v_project_url is null or v_secret is null then
    return new;
  end if;

  -- 本文は通知IDだけ。内容・宛先の token は Edge Function が service role で読む
  perform net.http_post(
    url     := v_project_url || '/functions/v1/send-push',
    body    := jsonb_build_object('notification_id', new.id),
    headers := jsonb_build_object(
                 'Content-Type', 'application/json',
                 'x-send-push-secret', v_secret
               )
  );

  return new;
end;
$$;

comment on function public.send_push_notification() is '通知の行が入ったら Edge Function send-push を呼ぶ(トリガー専用)';

revoke all on function public.send_push_notification() from public, anon, authenticated;

create trigger notifications_send_push
  after insert on public.notifications
  for each row execute function public.send_push_notification();
