begin;
select plan(21);

-- ===== テストデータ(postgres 権限)=====
-- carol=相談者 / bob=占い師 / dave=無関係のユーザー
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000c1', 'carol@example.com'),
  ('00000000-0000-0000-0000-0000000000b2', 'bob@example.com'),
  ('00000000-0000-0000-0000-0000000000d3', 'dave@example.com');

insert into public.teller_profiles (profile_id) values
  ('00000000-0000-0000-0000-0000000000b2');

-- s1=active / s2=pending / s3=completed(いずれも carol → bob)
insert into public.sessions
  (id, applicant_id, recipient_id, consultant_id, teller_id, initiated_by, concern, status)
values
  ('00000000-0000-0000-0000-000000000601', '00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000b2',
   '00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000b2', 'consultant', 's1', 'active'),
  ('00000000-0000-0000-0000-000000000602', '00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000b2',
   '00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000b2', 'consultant', 's2', 'pending'),
  ('00000000-0000-0000-0000-000000000603', '00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000b2',
   '00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000b2', 'consultant', 's3', 'completed');

-- now() はトランザクション内で固定されるので、「1日前」に戻してから比較する
update public.sessions
   set last_activity_at = now() - interval '1 day'
 where id = '00000000-0000-0000-0000-000000000601';

-- 占い師 bob が最初のメッセージを送った状態
insert into public.messages (id, session_id, sender_id, content) values
  ('00000000-0000-0000-0000-000000000701', '00000000-0000-0000-0000-000000000601',
   '00000000-0000-0000-0000-0000000000b2', 'bobの最初のメッセージ');

-- 1. RLS が有効
select ok(
  (select relrowsecurity from pg_class where oid = 'public.messages'::regclass),
  'messages: RLS が有効'
);

-- ===== anon =====
set local role anon;

-- 2. anon は select できない
select throws_ok($$ select * from public.messages $$, '42501', null,
  'anon は messages を select できない');

-- 3. anon は insert できない
select throws_ok(
  $$ insert into public.messages (session_id, sender_id, content) values
     ('00000000-0000-0000-0000-000000000601', '00000000-0000-0000-0000-0000000000c1', 'x') $$,
  '42501', null, 'anon は messages を insert できない'
);
reset role;

-- 4. 占い師のメッセージでは last_activity_at は動かない(最初のメッセージ送信後も1日前のまま)
select is(
  (select last_activity_at from public.sessions where id = '00000000-0000-0000-0000-000000000601'),
  now() - interval '1 day',
  '占い師のメッセージでは last_activity_at は更新されない'
);

-- ===== carol(相談者)=====
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}', true);

-- 5. 自分のセッションのメッセージは見える
select is(
  (select count(*)::int from public.messages where session_id = '00000000-0000-0000-0000-000000000601'),
  1, '当事者はセッションのメッセージを select できる'
);

-- 6. active なセッションに、自分名義で送信できる
select lives_ok(
  $$ insert into public.messages (session_id, sender_id, content) values
     ('00000000-0000-0000-0000-000000000601', '00000000-0000-0000-0000-0000000000c1', 'carolのメッセージ') $$,
  '当事者は active なセッションに送信できる'
);

-- 7. 他人(bob)になりすました送信はできない
select throws_ok(
  $$ insert into public.messages (session_id, sender_id, content) values
     ('00000000-0000-0000-0000-000000000601', '00000000-0000-0000-0000-0000000000b2', 'なりすまし') $$,
  '42501', null, '他人名義では送信できない'
);

-- 8. pending のセッションには送信できない
select throws_ok(
  $$ insert into public.messages (session_id, sender_id, content) values
     ('00000000-0000-0000-0000-000000000602', '00000000-0000-0000-0000-0000000000c1', 'x') $$,
  '42501', null, 'pending のセッションには送信できない'
);

-- 9. completed のセッションには送信できない
select throws_ok(
  $$ insert into public.messages (session_id, sender_id, content) values
     ('00000000-0000-0000-0000-000000000603', '00000000-0000-0000-0000-0000000000c1', 'x') $$,
  '42501', null, 'completed のセッションには送信できない'
);

-- 10. update できない
select throws_ok(
  $$ update public.messages set content = '改ざん' $$,
  '42501', null, 'authenticated は messages を update できない'
);

-- 11. delete できない
select throws_ok(
  $$ delete from public.messages $$,
  '42501', null, 'authenticated は messages を delete できない'
);
reset role;

-- 12. 相談者のメッセージで last_activity_at が更新される
select is(
  (select last_activity_at from public.sessions where id = '00000000-0000-0000-0000-000000000601'),
  now(),
  '相談者のメッセージで last_activity_at が更新される'
);

-- ===== dave(無関係)=====
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000d3","role":"authenticated"}', true);

-- 13. 当事者でない人には見えない
select is(
  (select count(*)::int from public.messages where session_id = '00000000-0000-0000-0000-000000000601'),
  0, '当事者でない人には messages が見えない'
);

-- 14. 当事者でない人は送信できない
select throws_ok(
  $$ insert into public.messages (session_id, sender_id, content) values
     ('00000000-0000-0000-0000-000000000601', '00000000-0000-0000-0000-0000000000d3', 'x') $$,
  '42501', null, '当事者でない人は送信できない'
);
reset role;

-- ===== bob(占い師)=====
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b2","role":"authenticated"}', true);

-- 15. 占い師にも相談者のメッセージが見える(自分の1件 + carol の1件)
select is(
  (select count(*)::int from public.messages where session_id = '00000000-0000-0000-0000-000000000601'),
  2, '占い師も同じセッションのメッセージを select できる'
);
reset role;

-- 時刻を1日前に戻して、占い師の送信で動かないことを確かめる
update public.sessions
   set last_activity_at = now() - interval '1 day'
 where id = '00000000-0000-0000-0000-000000000601';

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b2","role":"authenticated"}', true);

-- 16. 占い師も送信できる
select lives_ok(
  $$ insert into public.messages (session_id, sender_id, content) values
     ('00000000-0000-0000-0000-000000000601', '00000000-0000-0000-0000-0000000000b2', 'bobの返信') $$,
  '占い師も active なセッションに送信できる'
);
reset role;

-- 17. 占い師の返信では last_activity_at は動かない
select is(
  (select last_activity_at from public.sessions where id = '00000000-0000-0000-0000-000000000601'),
  now() - interval '1 day',
  '占い師の返信では last_activity_at は更新されない'
);

-- ===== 制約(postgres 権限)=====
-- 18. 空の本文は入らない
select throws_ok(
  $$ insert into public.messages (session_id, sender_id, content) values
     ('00000000-0000-0000-0000-000000000601', '00000000-0000-0000-0000-0000000000c1', '  ') $$,
  '23514', null, '空白だけの本文は入らない'
);

-- 19. content は NOT NULL
select throws_ok(
  $$ insert into public.messages (session_id, sender_id, content) values
     ('00000000-0000-0000-0000-000000000601', '00000000-0000-0000-0000-0000000000c1', null) $$,
  '23502', null, 'content は NULL にできない'
);

-- 20. 存在しない session_id は外部キー違反
select throws_ok(
  $$ insert into public.messages (session_id, sender_id, content) values
     (gen_random_uuid(), '00000000-0000-0000-0000-0000000000c1', 'x') $$,
  '23503', null, '存在しない session_id は外部キー違反'
);

-- 21. セッションを消すと messages も連鎖削除される
delete from public.sessions where id = '00000000-0000-0000-0000-000000000601';
select is(
  (select count(*)::int from public.messages where session_id = '00000000-0000-0000-0000-000000000601'),
  0, 'sessions を削除すると messages も連鎖削除される'
);

select * from finish();
rollback;