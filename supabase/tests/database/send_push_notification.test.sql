begin;
select plan(7);

-- ===== テストデータ(postgres 権限)=====
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000c1', 'carol@example.com');

-- 環境に登録済みのシークレットがあっても結果が変わらないよう、いったん消す(rollback で戻る)
delete from vault.secrets where name in ('project_url', 'send_push_secret');

-- ===== Vault にシークレットが無いとき =====
insert into public.notifications (id, recipient_id, type) values
  ('00000000-0000-0000-0000-000000000a01', '00000000-0000-0000-0000-0000000000c1', 'review_request');

-- 1. 通知の行は作られる
select is(
  (select count(*)::int from public.notifications where id = '00000000-0000-0000-0000-000000000a01'),
  1, 'シークレットが無くても、通知の行は作られる'
);

-- 2. 送信は積まれない
select is(
  (select count(*)::int from net.http_request_queue where url like '%/functions/v1/send-push'),
  0, 'シークレットが無いときは、送信を積まない'
);

-- ===== Vault にシークレットがあるとき =====
select vault.create_secret('https://example.supabase.co', 'project_url');
select vault.create_secret('test-secret', 'send_push_secret');

insert into public.notifications (id, recipient_id, type) values
  ('00000000-0000-0000-0000-000000000a02', '00000000-0000-0000-0000-0000000000c1', 'review_request');

-- 3. 1件だけ積まれる
select is(
  (select count(*)::int from net.http_request_queue where url like '%/functions/v1/send-push'),
  1, '通知の行が入ると、send-push への送信が1件積まれる'
);

-- 4. 宛先は project_url の Edge Function
select is(
  (select url from net.http_request_queue where url like '%/functions/v1/send-push'),
  'https://example.supabase.co/functions/v1/send-push',
  '宛先は project_url の /functions/v1/send-push'
);

-- 5. 共有シークレットをヘッダーに付ける
select is(
  (select headers ->> 'x-send-push-secret' from net.http_request_queue where url like '%/functions/v1/send-push'),
  'test-secret', 'ヘッダーに send_push_secret を付ける'
);

-- 6. 本文は通知IDだけ(内容は Edge Function が service role で読む)
select is(
  (select convert_from(body, 'utf8')::jsonb from net.http_request_queue where url like '%/functions/v1/send-push'),
  '{"notification_id": "00000000-0000-0000-0000-000000000a02"}'::jsonb,
  '本文は notification_id だけ'
);

-- ===== 関数の実行権限 =====
-- 7. authenticated はトリガー関数を直接呼べない
select is(
  has_function_privilege('authenticated', 'public.send_push_notification()', 'execute'),
  false, 'authenticated は send_push_notification を実行できない'
);

select * from finish();
rollback;
