begin;
select plan(18);

-- ===== テストデータ(postgres 権限) =====
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000e1', 'alice@example.com'),
  ('00000000-0000-0000-0000-0000000000e2', 'bob@example.com'),
  ('00000000-0000-0000-0000-0000000000e3', 'teller@example.com'),
  ('00000000-0000-0000-0000-0000000000e4', 'carol@example.com');

insert into public.teller_profiles (profile_id) values
  ('00000000-0000-0000-0000-0000000000e3');

-- bob は teller をお気に入り登録している
insert into public.favorites (consultant_id, teller_id) values
  ('00000000-0000-0000-0000-0000000000e2', '00000000-0000-0000-0000-0000000000e3');

-- 1. RLS が有効
select ok(
  (select relrowsecurity from pg_class where oid = 'public.favorites'::regclass),
  'favorites: RLS が有効'
);

-- ===== anon =====
set local role anon;

-- 2. anon は select できない
select throws_ok(
  $$ select * from public.favorites $$,
  '42501', null,
  'anon は favorites を select できない'
);

-- 3. anon は insert できない
select throws_ok(
  $$ insert into public.favorites (consultant_id, teller_id) values
     ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000e3') $$,
  '42501', null,
  'anon は favorites を insert できない'
);
reset role;

-- ===== authenticated(alice) =====
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000e1","role":"authenticated"}', true);

-- 4. alice には bob の登録が見えない(自分の分は 0 件)
select is(
  (select count(*)::int from public.favorites),
  0,
  'alice には他人の favorites が見えない'
);

-- 5. alice は自分名義で insert できる
select lives_ok(
  $$ insert into public.favorites (consultant_id, teller_id) values
     ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000e3') $$,
  'alice は自分の favorites を insert できる'
);

-- 6. alice は他人名義では insert できない
select throws_ok(
  $$ insert into public.favorites (consultant_id, teller_id) values
     ('00000000-0000-0000-0000-0000000000e2', '00000000-0000-0000-0000-0000000000e3') $$,
  '42501', null,
  'alice は他人名義の favorites を insert できない'
);

-- 7. alice は update できない
select throws_ok(
  $$ update public.favorites set teller_id = teller_id $$,
  '42501', null,
  'authenticated は favorites を update できない'
);

-- 8. alice が bob の登録を delete しても 0 行、自分の登録は消せる
delete from public.favorites
  where consultant_id = '00000000-0000-0000-0000-0000000000e2';
delete from public.favorites
  where consultant_id = '00000000-0000-0000-0000-0000000000e1';
reset role;

select is(
  (select count(*)::int from public.favorites
    where consultant_id = '00000000-0000-0000-0000-0000000000e2'),
  1,
  'alice は他人の favorites を delete できない'
);

-- 9. 自分の登録は消せた
select is(
  (select count(*)::int from public.favorites
    where consultant_id = '00000000-0000-0000-0000-0000000000e1'),
  0,
  'alice は自分の favorites を delete できる'
);

-- ===== 制約(postgres 権限) =====
-- 10. 同じ組み合わせは重複できない
select throws_ok(
  $$ insert into public.favorites (consultant_id, teller_id) values
     ('00000000-0000-0000-0000-0000000000e2', '00000000-0000-0000-0000-0000000000e3') $$,
  '23505', null,
  '同じ組み合わせは重複登録できない'
);

-- 11. 占い師でない teller_id は外部キー違反
select throws_ok(
  $$ insert into public.favorites (consultant_id, teller_id) values
     ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000e2') $$,
  '23503', null,
  '占い師でない teller_id は外部キー違反'
);

-- 12. 自分自身はお気に入り登録できない(占い師は相談者にもなれるため)
select throws_ok(
  $$ insert into public.favorites (consultant_id, teller_id) values
     ('00000000-0000-0000-0000-0000000000e3', '00000000-0000-0000-0000-0000000000e3') $$,
  '23514', null,
  '自分自身はお気に入り登録できない'
);

-- ===== お気に入りの人数(teller_profiles.favorite_count)=====
-- この時点の登録は bob の1件だけ
-- 13. 相談者が登録すると数え直す。carol からは RLS で bob の行が見えないが、それも数える
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000e4","role":"authenticated"}', true);
insert into public.favorites (consultant_id, teller_id) values
  ('00000000-0000-0000-0000-0000000000e4', '00000000-0000-0000-0000-0000000000e3');
reset role;

select is(
  (select favorite_count from public.teller_profiles
    where profile_id = '00000000-0000-0000-0000-0000000000e3'),
  2,
  '登録すると favorite_count が増える(RLS で見えない他人の登録も数える)'
);

-- 14. 解除すると数え直す
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000e4","role":"authenticated"}', true);
delete from public.favorites
  where consultant_id = '00000000-0000-0000-0000-0000000000e4';
reset role;

select is(
  (select favorite_count from public.teller_profiles
    where profile_id = '00000000-0000-0000-0000-0000000000e3'),
  1,
  '解除すると favorite_count が減る'
);

-- 15. 相談者が退会する(auth.users の削除で favorites が連鎖削除される)と数え直す
delete from auth.users where id = '00000000-0000-0000-0000-0000000000e2';

select is(
  (select favorite_count from public.teller_profiles
    where profile_id = '00000000-0000-0000-0000-0000000000e3'),
  0,
  '相談者が退会すると favorite_count が減る'
);

-- 16. 占い師本人は favorite_count を書き換えられない
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000e3","role":"authenticated"}', true);
select throws_ok(
  $$ update public.teller_profiles set favorite_count = 100
      where profile_id = '00000000-0000-0000-0000-0000000000e3' $$,
  '42501', null,
  '占い師本人は favorite_count を書き換えられない'
);
reset role;

-- 17. 占い師の登録を消しても、連鎖削除される favorites のトリガーでエラーにならない
insert into public.favorites (consultant_id, teller_id) values
  ('00000000-0000-0000-0000-0000000000e4', '00000000-0000-0000-0000-0000000000e3');
select lives_ok(
  $$ delete from public.teller_profiles
      where profile_id = '00000000-0000-0000-0000-0000000000e3' $$,
  'お気に入りされている占い師の登録を消しても、エラーにならない'
);

-- 18. 占い師の登録を消すと favorites も連鎖削除される
select is(
  (select count(*)::int from public.favorites
    where teller_id = '00000000-0000-0000-0000-0000000000e3'),
  0,
  'teller_profiles を削除すると favorites も連鎖削除される'
);

select * from finish();
rollback;