begin;
select plan(20);

-- ===== テストデータ(postgres 権限)=====
-- carol=相談者 / t1〜t7=占い師
-- 同じ相談者と占い師の間で承認待ち・進行中は1件までなので、セッションごとに占い師を分ける
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000c1', 'carol@example.com'),
  ('00000000-0000-0000-0000-0000000000d1', 't1@example.com'),
  ('00000000-0000-0000-0000-0000000000d2', 't2@example.com'),
  ('00000000-0000-0000-0000-0000000000d3', 't3@example.com'),
  ('00000000-0000-0000-0000-0000000000d4', 't4@example.com'),
  ('00000000-0000-0000-0000-0000000000d5', 't5@example.com'),
  ('00000000-0000-0000-0000-0000000000d6', 't6@example.com'),
  ('00000000-0000-0000-0000-0000000000d7', 't7@example.com');

insert into public.teller_profiles (profile_id) values
  ('00000000-0000-0000-0000-0000000000d1'),
  ('00000000-0000-0000-0000-0000000000d2'),
  ('00000000-0000-0000-0000-0000000000d3'),
  ('00000000-0000-0000-0000-0000000000d4'),
  ('00000000-0000-0000-0000-0000000000d5'),
  ('00000000-0000-0000-0000-0000000000d6'),
  ('00000000-0000-0000-0000-0000000000d7');

-- 承認待ち
--   p1: 期限切れ / p2: 期限ちょうど / p3: 期限内 / p4: 期限内だが last_activity_at は古い(自動完了の対象外)
insert into public.sessions
  (id, applicant_id, recipient_id, consultant_id, teller_id, initiated_by, concern, status, expires_at, last_activity_at)
values
  ('00000000-0000-0000-0000-000000000701', '00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000d1',
   '00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000d1', 'consultant', 'p1', 'pending',
   now() - interval '1 minute', now()),
  ('00000000-0000-0000-0000-000000000702', '00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000d2',
   '00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000d2', 'consultant', 'p2', 'pending',
   now(), now()),
  ('00000000-0000-0000-0000-000000000703', '00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000d3',
   '00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000d3', 'consultant', 'p3', 'pending',
   now() + interval '1 hour', now()),
  ('00000000-0000-0000-0000-000000000704', '00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000d4',
   '00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000d4', 'consultant', 'p4', 'pending',
   now() + interval '1 hour', now() - interval '8 days');

-- 進行中
--   a1: 相談者の最終操作から7日を過ぎた / a2: ちょうど7日 / a3: 7日以内
insert into public.sessions
  (id, applicant_id, recipient_id, consultant_id, teller_id, initiated_by, concern, status, last_activity_at)
values
  ('00000000-0000-0000-0000-000000000711', '00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000d5',
   '00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000d5', 'consultant', 'a1', 'active',
   now() - interval '7 days 1 minute'),
  ('00000000-0000-0000-0000-000000000712', '00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000d6',
   '00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000d6', 'consultant', 'a2', 'active',
   now() - interval '7 days'),
  ('00000000-0000-0000-0000-000000000713', '00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000d7',
   '00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000d7', 'consultant', 'a3', 'active',
   now() - interval '6 days');

-- ===== 承認待ちの期限切れ =====
-- 時刻を待たずに、ジョブに登録されたコマンドをそのまま実行する(cron と同じく auth.uid() が null の状態で)
select set_config('request.jwt.claims', '', true);
do $$
begin
  execute (select command from cron.job where jobname = 'expire-session-requests');
end;
$$;

-- 1. 期限を過ぎた pending は expired になる
select is(
  (select status from public.sessions where id = '00000000-0000-0000-0000-000000000701'),
  'expired', '期限を過ぎた pending は expired になる'
);

-- 2. 期限ちょうどの pending はまだ変えない(承認・拒否のガード expires_at < now() と揃える)
select is(
  (select status from public.sessions where id = '00000000-0000-0000-0000-000000000702'),
  'pending', '期限ちょうどの pending は expired にしない'
);

-- 3. 期限内の pending は変わらない
select is(
  (select status from public.sessions where id = '00000000-0000-0000-0000-000000000703'),
  'pending', '期限内の pending は expired にしない'
);

-- 4. active は期限切れの対象にならない
select is(
  (select status from public.sessions where id = '00000000-0000-0000-0000-000000000711'),
  'active', 'active は expire_session_requests の対象にならない'
);

-- 5. 期限切れでは通知を作らない(申込み時の通知だけが残る)
select is(
  (select count(*)::int from public.notifications
    where session_id = '00000000-0000-0000-0000-000000000701'
      and type <> 'session_request_received'),
  0, '期限切れでは通知が作られない'
);

-- ===== 自動完了 =====
do $$
begin
  execute (select command from cron.job where jobname = 'auto-complete-sessions');
end;
$$;

-- 6. 相談者の最終操作から7日を過ぎた active は auto_completed になる
select is(
  (select status from public.sessions where id = '00000000-0000-0000-0000-000000000711'),
  'auto_completed', '最終操作から7日を過ぎた active は auto_completed になる'
);

-- 7. completed_at が設定される
select isnt(
  (select completed_at from public.sessions where id = '00000000-0000-0000-0000-000000000711'),
  null, '自動完了で completed_at が設定される'
);

-- 8. ちょうど7日の active はまだ変えない
select is(
  (select status from public.sessions where id = '00000000-0000-0000-0000-000000000712'),
  'active', '最終操作からちょうど7日の active は自動完了しない'
);

-- 9. 7日以内の active は変わらない
select is(
  (select status from public.sessions where id = '00000000-0000-0000-0000-000000000713'),
  'active', '最終操作から7日以内の active は自動完了しない'
);

-- 10. pending は last_activity_at が古くても自動完了の対象にならない
select is(
  (select status from public.sessions where id = '00000000-0000-0000-0000-000000000704'),
  'pending', 'pending は auto_complete_sessions の対象にならない'
);

-- 11. 自動完了は相談者と占い師の双方に通知する
select results_eq(
  $$ select recipient_id from public.notifications
      where session_id = '00000000-0000-0000-0000-000000000711'
        and type = 'session_auto_completed'
      order by recipient_id $$,
  $$ values ('00000000-0000-0000-0000-0000000000c1'::uuid), ('00000000-0000-0000-0000-0000000000d5'::uuid) $$,
  '自動完了で相談者と占い師の双方に session_auto_completed が届く'
);

-- 12. 占い師の完了セッション数に数えられる
select is(
  (select session_count from public.teller_profiles where profile_id = '00000000-0000-0000-0000-0000000000d5'),
  1, '自動完了したセッションは session_count に数えられる'
);

-- ===== 実行権限 =====
-- 13〜14. 利用者からは呼べない(システムの定期処理専用)
select ok(
  not has_function_privilege('authenticated', 'public.expire_session_requests()', 'execute')
  and not has_function_privilege('anon', 'public.expire_session_requests()', 'execute'),
  '利用者は expire_session_requests を実行できない'
);

select ok(
  not has_function_privilege('authenticated', 'public.auto_complete_sessions()', 'execute')
  and not has_function_privilege('anon', 'public.auto_complete_sessions()', 'execute'),
  '利用者は auto_complete_sessions を実行できない'
);

-- ===== 定期実行のジョブ =====
-- 15. pg_cron が有効
select has_extension('pg_cron', 'pg_cron が有効');

-- 16〜17. 期限切れ・自動完了は10分ごと
select is(
  (select schedule from cron.job where jobname = 'expire-session-requests'),
  '*/10 * * * *', '期限切れのジョブが10分ごとに登録されている'
);

select is(
  (select schedule from cron.job where jobname = 'auto-complete-sessions'),
  '*/10 * * * *', '自動完了のジョブが10分ごとに登録されている'
);

-- 18. 実行履歴の片付けは1日1回
select is(
  (select schedule from cron.job where jobname = 'delete-old-cron-job-run-details'),
  '0 18 * * *', '実行履歴を片付けるジョブが1日1回(日本時間 3:00)登録されている'
);

-- 19〜20. 片付けのジョブは7日より古い履歴だけを消す
insert into cron.job_run_details (jobid, runid, status, start_time, end_time) values
  (0, -1, 'succeeded', now() - interval '8 days', now() - interval '8 days'),
  (0, -2, 'succeeded', now() - interval '6 days', now() - interval '6 days');

do $$
begin
  execute (select command from cron.job where jobname = 'delete-old-cron-job-run-details');
end;
$$;

select is(
  (select count(*)::int from cron.job_run_details where runid = -1),
  0, '7日より古い実行履歴は消える'
);

select is(
  (select count(*)::int from cron.job_run_details where runid = -2),
  1, '7日以内の実行履歴は残る'
);

select * from finish();
rollback;
