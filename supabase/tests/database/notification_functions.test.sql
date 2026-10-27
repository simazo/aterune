begin;
select plan(17);

-- ===== テストデータ(postgres 権限)=====
-- alice=相談者 / bob・carl=占い師 / dave=相談者(あとでプロフィールを消す)
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000c1', 'alice@example.com'),
  ('00000000-0000-0000-0000-0000000000b2', 'bob@example.com'),
  ('00000000-0000-0000-0000-0000000000b3', 'carl@example.com'),
  ('00000000-0000-0000-0000-0000000000c4', 'dave@example.com');

insert into public.teller_profiles (profile_id) values
  ('00000000-0000-0000-0000-0000000000b2'),
  ('00000000-0000-0000-0000-0000000000b3');

update public.profiles set display_name = 'ボブ', avatar_path = '00000000-0000-0000-0000-0000000000b2/1.jpg'
 where id = '00000000-0000-0000-0000-0000000000b2';
update public.profiles set display_name = 'カール'
 where id = '00000000-0000-0000-0000-0000000000b3';

-- s1=alice → bob / s2=alice → carl / s3=dave → bob / s4=dave → carl
insert into public.sessions
  (id, applicant_id, recipient_id, consultant_id, teller_id, initiated_by, concern, status)
values
  ('00000000-0000-0000-0000-000000000701', '00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000b2',
   '00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000b2', 'consultant', 's1', 'active'),
  ('00000000-0000-0000-0000-000000000702', '00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000b3',
   '00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000b3', 'consultant', 's2', 'active'),
  ('00000000-0000-0000-0000-000000000703', '00000000-0000-0000-0000-0000000000c4', '00000000-0000-0000-0000-0000000000b2',
   '00000000-0000-0000-0000-0000000000c4', '00000000-0000-0000-0000-0000000000b2', 'consultant', 's3', 'active'),
  ('00000000-0000-0000-0000-000000000704', '00000000-0000-0000-0000-0000000000c4', '00000000-0000-0000-0000-0000000000b3',
   '00000000-0000-0000-0000-0000000000c4', '00000000-0000-0000-0000-0000000000b3', 'consultant', 's4', 'active');

-- 申込みのトリガーが作った通知は数えない
delete from public.notifications;

-- alice 宛て:
--   s1 のメッセージ3件(未読2・既読1) → 1行(最新 5分前・未読2)
--   s2 のメッセージ2件(すべて既読)   → 1行(最新 25分前・未読0)
--   s1 の承認(既読・60分前) / s1 のレビュー依頼(未読・1分前) → まとめずに1行ずつ
--   セッションに紐づかない行(未読) → 一覧にも件数にも入れない
-- bob 宛て: s1 のメッセージ(未読)は alice には返らない
insert into public.notifications (recipient_id, type, session_id, is_read, created_at) values
  ('00000000-0000-0000-0000-0000000000c1', 'review_request',           null,                                   false, now()),
  ('00000000-0000-0000-0000-0000000000c1', 'message_received',         '00000000-0000-0000-0000-000000000701', true,  now() - interval '20 minutes'),
  ('00000000-0000-0000-0000-0000000000c1', 'message_received',         '00000000-0000-0000-0000-000000000701', false, now() - interval '10 minutes'),
  ('00000000-0000-0000-0000-0000000000c1', 'message_received',         '00000000-0000-0000-0000-000000000701', false, now() - interval '5 minutes'),
  ('00000000-0000-0000-0000-0000000000c1', 'message_received',         '00000000-0000-0000-0000-000000000702', true,  now() - interval '30 minutes'),
  ('00000000-0000-0000-0000-0000000000c1', 'message_received',         '00000000-0000-0000-0000-000000000702', true,  now() - interval '25 minutes'),
  ('00000000-0000-0000-0000-0000000000c1', 'session_request_approved', '00000000-0000-0000-0000-000000000701', true,  now() - interval '60 minutes'),
  ('00000000-0000-0000-0000-0000000000c1', 'review_request',           '00000000-0000-0000-0000-000000000701', false, now() - interval '1 minute'),
  ('00000000-0000-0000-0000-0000000000b2', 'message_received',         '00000000-0000-0000-0000-000000000701', false, now() - interval '3 minutes');

-- bob 宛て: プロフィールの無い dave とのセッション
insert into public.notifications (recipient_id, type, session_id, created_at) values
  ('00000000-0000-0000-0000-0000000000b2', 'session_request_received', '00000000-0000-0000-0000-000000000703', now() - interval '2 minutes');
delete from public.profiles where id = '00000000-0000-0000-0000-0000000000c4';

-- carl 宛て: 55件(すべて未読。まとめない種類)
insert into public.notifications (recipient_id, type, session_id, created_at)
select '00000000-0000-0000-0000-0000000000b3', 'session_completed', '00000000-0000-0000-0000-000000000704',
       now() - make_interval(mins => i)
  from generate_series(1, 55) as i;

-- ===== 実行権限 =====
-- 1-5. anon は実行できず、authenticated は実行できる
select is(has_function_privilege('anon', 'public.list_grouped_notifications()', 'execute'),
  false, 'anon は list_grouped_notifications を実行できない');
select is(has_function_privilege('anon', 'public.list_my_notifications()', 'execute'),
  false, 'anon は list_my_notifications を実行できない');
select is(has_function_privilege('anon', 'public.count_unread_notifications()', 'execute'),
  false, 'anon は count_unread_notifications を実行できない');
select is(has_function_privilege('authenticated', 'public.list_my_notifications()', 'execute'),
  true, 'authenticated は list_my_notifications を実行できる');
select is(has_function_privilege('authenticated', 'public.count_unread_notifications()', 'execute'),
  true, 'authenticated は count_unread_notifications を実行できる');

-- ===== alice =====
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}', true);

-- 6. 自分宛ての通知だけを、メッセージはセッションごとにまとめて返す(セッションに紐づかない行は返さない)
select is(
  (select count(*)::int from public.list_my_notifications()),
  4, 'alice には自分宛ての4行(メッセージはセッションごとに1行。セッションに紐づかない行は除く)だけが返る'
);

-- 7. 新しい順に並ぶ
select is(
  (select array_agg(type order by ord)
     from public.list_my_notifications() with ordinality as t(session_id, type, created_at, unread_count,
          partner_display_name, partner_avatar_path, ord)),
  array['review_request', 'message_received', 'message_received', 'session_request_approved'],
  '新しい順に並ぶ'
);

-- 8-9. 未読の残るメッセージの行は、未読の件数と最新の時刻を返す
select is(
  (select unread_count from public.list_my_notifications()
    where session_id = '00000000-0000-0000-0000-000000000701' and type = 'message_received'),
  2, 'まとめたメッセージの行は未読の件数を返す'
);
select ok(
  (select created_at between now() - interval '5 minutes 1 second' and now() - interval '4 minutes 59 seconds'
     from public.list_my_notifications()
    where session_id = '00000000-0000-0000-0000-000000000701' and type = 'message_received'),
  'まとめたメッセージの行の時刻は、最新の通知の時刻'
);

-- 10. すべて既読のメッセージの行は、未読の件数が 0
select is(
  (select unread_count from public.list_my_notifications()
    where session_id = '00000000-0000-0000-0000-000000000702' and type = 'message_received'),
  0, 'すべて既読のメッセージの行は未読の件数が 0'
);

-- 11. まとめない種類は、未読なら 1
select is(
  (select unread_count from public.list_my_notifications() where type = 'review_request'),
  1, 'まとめない種類の未読の行は未読の件数が 1'
);

-- 12. 相手の表示名・アイコンを返す
select is(
  (select array[partner_display_name, partner_avatar_path] from public.list_my_notifications()
    where session_id = '00000000-0000-0000-0000-000000000701' and type = 'message_received'),
  array['ボブ', '00000000-0000-0000-0000-0000000000b2/1.jpg'],
  '相手(占い師)の表示名とアイコンを返す'
);

-- 13. まとめた後の未読の行数を数える(s1 のメッセージ2件は1と数え、セッションに紐づかない行は数えない)
select is(
  public.count_unread_notifications(),
  2, 'count_unread_notifications はまとめた後の未読の行数を返す(セッションに紐づかない行は数えない)'
);

-- ===== bob =====
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b2","role":"authenticated"}', true);

-- 14. 相手のプロフィールが無ければ、表示名・アイコンは null
select ok(
  (select partner_display_name is null and partner_avatar_path is null
     from public.list_my_notifications()
    where session_id = '00000000-0000-0000-0000-000000000703'),
  '相手のプロフィールが無ければ、表示名・アイコンは null'
);

-- ===== carl =====
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b3","role":"authenticated"}', true);

-- 15-16. 最大50行に絞り、新しいものから返す
select is(
  (select count(*)::int from public.list_my_notifications()),
  50, '最大50行に絞る'
);
select ok(
  (select min(created_at) > now() - interval '51 minutes' from public.list_my_notifications()),
  '新しい50行を返す'
);

-- 17. 未読の件数は50行の上限を掛けずに数える
select is(
  public.count_unread_notifications(),
  55, 'count_unread_notifications は一覧の上限に関係なく数える'
);

reset role;

select * from finish();
rollback;
