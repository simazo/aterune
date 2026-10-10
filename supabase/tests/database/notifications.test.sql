begin;
select plan(14);

-- ===== テストデータ(postgres 権限)=====
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000c1', 'carol@example.com'),
  ('00000000-0000-0000-0000-0000000000b2', 'bob@example.com');

insert into public.teller_profiles (profile_id) values
  ('00000000-0000-0000-0000-0000000000b2');

-- セッションの insert で通知トリガーが動くため、件数は seed の id で絞って確認する
insert into public.notifications (id, recipient_id, type) values
  ('00000000-0000-0000-0000-000000000a11', '00000000-0000-0000-0000-0000000000c1', 'review_request'),
  ('00000000-0000-0000-0000-000000000a12', '00000000-0000-0000-0000-0000000000b2', 'session_completed');

-- 1. RLS が有効
select ok(
  (select relrowsecurity from pg_class where oid = 'public.notifications'::regclass),
  'notifications: RLS が有効'
);

-- ===== anon =====
set local role anon;

-- 2. anon は select できない
select throws_ok($$ select * from public.notifications $$, '42501', null,
  'anon は notifications を select できない');

-- 3. anon は update できない
select throws_ok($$ update public.notifications set is_read = true $$, '42501', null,
  'anon は notifications を update できない');
reset role;

-- ===== carol =====
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}', true);

-- 4. 自分宛ての通知だけ見える
select is(
  (select count(*)::int from public.notifications
    where id in ('00000000-0000-0000-0000-000000000a11', '00000000-0000-0000-0000-000000000a12')),
  1, '自分宛ての通知だけ select できる'
);

-- 5. 自分宛ての通知を既読にできる
select lives_ok(
  $$ update public.notifications set is_read = true
     where id = '00000000-0000-0000-0000-000000000a11' $$,
  '自分宛ての通知を既読にできる'
);

-- 6. 既読になっている
select is(
  (select is_read from public.notifications where id = '00000000-0000-0000-0000-000000000a11'),
  true, 'is_read が true になっている'
);

-- 7. type は変更できない(列 GRANT)
select throws_ok(
  $$ update public.notifications set type = 'session_completed'
     where id = '00000000-0000-0000-0000-000000000a11' $$,
  '42501', null, 'type は update できない'
);

-- 8. recipient_id は変更できない(列 GRANT)
select throws_ok(
  $$ update public.notifications set recipient_id = '00000000-0000-0000-0000-0000000000b2'
     where id = '00000000-0000-0000-0000-000000000a11' $$,
  '42501', null, 'recipient_id は update できない'
);

-- 9. 自分では insert できない(通知はトリガーが作る)
select throws_ok(
  $$ insert into public.notifications (recipient_id, type) values
     ('00000000-0000-0000-0000-0000000000c1', 'review_request') $$,
  '42501', null, 'authenticated は notifications を insert できない'
);

-- 10. delete できない
select throws_ok($$ delete from public.notifications $$, '42501', null,
  'authenticated は notifications を delete できない');

-- 他人(bob)宛ての通知を既読にしても 0 行
update public.notifications set is_read = true
  where id = '00000000-0000-0000-0000-000000000a12';
reset role;

-- 11. 他人宛ての通知は既読にできない
select is(
  (select is_read from public.notifications where id = '00000000-0000-0000-0000-000000000a12'),
  false, '他人宛ての通知は update できない'
);

-- ===== 制約(postgres 権限)=====
-- 12. 想定外の type は入らない
select throws_ok(
  $$ insert into public.notifications (recipient_id, type) values
     ('00000000-0000-0000-0000-0000000000c1', 'unknown_type') $$,
  '23514', null, '想定外の type は入らない'
);

-- 13. 存在しない recipient_id は外部キー違反
select throws_ok(
  $$ insert into public.notifications (recipient_id, type) values
     (gen_random_uuid(), 'review_request') $$,
  '23503', null, '存在しない recipient_id は外部キー違反'
);

-- 14. セッションを消すと紐づく通知も連鎖削除される
insert into public.sessions
  (id, applicant_id, recipient_id, consultant_id, teller_id, initiated_by, concern)
values
  ('00000000-0000-0000-0000-0000000009f1', '00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000b2',
   '00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000b2', 'consultant', 'x');
insert into public.notifications (id, recipient_id, type, session_id) values
  ('00000000-0000-0000-0000-000000000a13', '00000000-0000-0000-0000-0000000000c1', 'review_request',
   '00000000-0000-0000-0000-0000000009f1');
delete from public.sessions where id = '00000000-0000-0000-0000-0000000009f1';
select is(
  (select count(*)::int from public.notifications where session_id = '00000000-0000-0000-0000-0000000009f1'),
  0, 'sessions を削除すると notifications も連鎖削除される'
);

select * from finish();
rollback;