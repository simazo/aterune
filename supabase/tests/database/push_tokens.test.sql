begin;
select plan(15);

-- ===== テストデータ(postgres 権限)=====
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000c1', 'carol@example.com'),
  ('00000000-0000-0000-0000-0000000000b2', 'bob@example.com');

insert into public.push_tokens (user_id, expo_push_token, platform) values
  ('00000000-0000-0000-0000-0000000000c1', 'carol-1', 'ios'),
  ('00000000-0000-0000-0000-0000000000b2', 'bob-1',   'android');

-- 1. RLS が有効
select ok(
  (select relrowsecurity from pg_class where oid = 'public.push_tokens'::regclass),
  'push_tokens: RLS が有効'
);

-- ===== anon =====
set local role anon;

-- 2. anon は select できない
select throws_ok($$ select * from public.push_tokens $$, '42501', null,
  'anon は push_tokens を select できない');

-- 3. anon は insert できない
select throws_ok(
  $$ insert into public.push_tokens (user_id, expo_push_token) values
     ('00000000-0000-0000-0000-0000000000c1', 'x') $$,
  '42501', null, 'anon は push_tokens を insert できない'
);
reset role;

-- ===== carol =====
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}', true);

-- 4. 自分のトークンだけが見える(bob の分は見えない)
select is(
  (select count(*)::int from public.push_tokens),
  1, '本人のトークンだけが select できる'
);

-- 5. 自分名義で insert できる
select lives_ok(
  $$ insert into public.push_tokens (user_id, expo_push_token, platform) values
     ('00000000-0000-0000-0000-0000000000c1', 'carol-2', 'ios') $$,
  '自分名義で insert できる'
);

-- 6. 他人名義では insert できない
select throws_ok(
  $$ insert into public.push_tokens (user_id, expo_push_token) values
     ('00000000-0000-0000-0000-0000000000b2', 'x') $$,
  '42501', null, '他人名義では insert できない'
);

-- 7. 同じユーザーの同じトークンは重複できない
select throws_ok(
  $$ insert into public.push_tokens (user_id, expo_push_token) values
     ('00000000-0000-0000-0000-0000000000c1', 'carol-1') $$,
  '23505', null, '同じ (user_id, expo_push_token) は重複できない'
);

-- 8. platform は ios / android / web のみ
select throws_ok(
  $$ insert into public.push_tokens (user_id, expo_push_token, platform) values
     ('00000000-0000-0000-0000-0000000000c1', 'carol-x', 'windows') $$,
  '23514', null, '想定外の platform は入らない'
);

-- 9. 空のトークンは入らない
select throws_ok(
  $$ insert into public.push_tokens (user_id, expo_push_token) values
     ('00000000-0000-0000-0000-0000000000c1', '') $$,
  '23514', null, '空のトークンは入らない'
);

-- 10. platform は NULL でもよい
select lives_ok(
  $$ insert into public.push_tokens (user_id, expo_push_token, platform) values
     ('00000000-0000-0000-0000-0000000000c1', 'carol-3', null) $$,
  'platform は NULL でも登録できる'
);

-- 11. update できない
select throws_ok(
  $$ update public.push_tokens set expo_push_token = 'hacked' $$,
  '42501', null, 'authenticated は push_tokens を update できない'
);

-- 他人(bob)のトークン削除は 0 行、自分の carol-2 は削除できる
delete from public.push_tokens where user_id = '00000000-0000-0000-0000-0000000000b2';
delete from public.push_tokens where expo_push_token = 'carol-2';
reset role;

-- 12. 他人のトークンは消せない
select is(
  (select count(*)::int from public.push_tokens where user_id = '00000000-0000-0000-0000-0000000000b2'),
  1, '他人のトークンは delete できない'
);

-- 13. 自分のトークンは消せた
select is(
  (select count(*)::int from public.push_tokens where expo_push_token = 'carol-2'),
  0, '自分のトークンは delete できる'
);

-- ===== 制約(postgres 権限)=====
-- 14. トークンは NOT NULL
select throws_ok(
  $$ insert into public.push_tokens (user_id, expo_push_token) values
     ('00000000-0000-0000-0000-0000000000c1', null) $$,
  '23502', null, 'expo_push_token は NULL にできない'
);

-- 15. ユーザーを消すとトークンも連鎖削除される
delete from auth.users where id = '00000000-0000-0000-0000-0000000000b2';
select is(
  (select count(*)::int from public.push_tokens where user_id = '00000000-0000-0000-0000-0000000000b2'),
  0, 'ユーザーを削除すると push_tokens も連鎖削除される'
);

select * from finish();
rollback;