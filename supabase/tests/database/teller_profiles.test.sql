begin;
select plan(20);

-- ---------- 準備 ----------
-- profiles は handle_new_user のトリガーで自動作成される
insert into auth.users (id, aud, role, email) values
  ('00000000-0000-0000-0000-0000000000c1', 'authenticated', 'authenticated', 'alice@example.com'),
  ('00000000-0000-0000-0000-0000000000c2', 'authenticated', 'authenticated', 'bob@example.com'),
  ('00000000-0000-0000-0000-0000000000c3', 'authenticated', 'authenticated', 'carol@example.com');

-- alice(c1)だけ占い師として登録済みにしておく(postgres 権限)
insert into public.teller_profiles (profile_id, self_pr)
  values ('00000000-0000-0000-0000-0000000000c1', 'alice の自己PR');

-- ---------- 1-3. 構造 ----------
select is(
  (select relrowsecurity from pg_class where oid = 'public.teller_profiles'::regclass),
  true,
  'teller_profiles は RLS が有効'
);

select has_trigger('public', 'teller_profiles', 'teller_profiles_set_updated_at',
  'teller_profiles に updated_at 用のトリガーが付いている');

select has_trigger('public', 'teller_profiles', 'teller_profiles_sync_is_teller',
  'teller_profiles に is_teller 同期用のトリガーが付いている');

-- ---------- 4-5. 同期関数を API から呼べないこと ----------
select is(
  has_function_privilege('anon', 'public.sync_is_teller()', 'execute'),
  false,
  'anon は sync_is_teller を実行できない'
);

select is(
  has_function_privilege('authenticated', 'public.sync_is_teller()', 'execute'),
  false,
  'authenticated は sync_is_teller を実行できない'
);

-- ---------- 6. 登録すると is_teller が true になる ----------
select is(
  (select is_teller from public.profiles
    where id = '00000000-0000-0000-0000-0000000000c1'),
  true,
  '占い師登録されると profiles.is_teller が true になる'
);

-- ---------- 7-8. anon(未ログイン) ----------
set local role anon;

select is(
  (select count(*)::int from public.teller_profiles),
  1,
  'anon は占い師プロフィールを読める'
);

select throws_ok(
  $$ insert into public.teller_profiles (profile_id)
       values ('00000000-0000-0000-0000-0000000000c3') $$,
  '42501',
  null,
  'anon は INSERT できない'
);

reset role;

-- ---------- 9-16. authenticated(bob = c2 としてログイン) ----------
set local role authenticated;
set local request.jwt.claims =
  '{"sub":"00000000-0000-0000-0000-0000000000c2","role":"authenticated"}';

select lives_ok(
  $$ insert into public.teller_profiles (profile_id, self_pr)
       values ('00000000-0000-0000-0000-0000000000c2', 'bob の自己PR') $$,
  '自分自身を占い師として登録できる'
);

select is(
  (select is_teller from public.profiles
    where id = '00000000-0000-0000-0000-0000000000c2'),
  true,
  'ユーザー自身の登録でも、トリガー経由で is_teller が true になる'
);

select throws_ok(
  $$ insert into public.teller_profiles (profile_id)
       values ('00000000-0000-0000-0000-0000000000c3') $$,
  '42501',
  null,
  '他人(carol)を占い師として登録することはできない'
);

select lives_ok(
  $$ update public.teller_profiles set self_pr = '更新しました'
       where profile_id = '00000000-0000-0000-0000-0000000000c2' $$,
  '自分の占い師プロフィールは更新できる'
);

select results_eq(
  $$ with u as (
       update public.teller_profiles set self_pr = 'hacked'
         where profile_id = '00000000-0000-0000-0000-0000000000c1' returning 1
     ) select count(*)::int from u $$,
  array[0],
  '他人の占い師プロフィールは更新できない(0行)'
);

select throws_ok(
  $$ update public.teller_profiles set average_rating = 5.00
       where profile_id = '00000000-0000-0000-0000-0000000000c2' $$,
  '42501',
  null,
  '自分で average_rating は書き換えられない'
);

select throws_ok(
  $$ update public.teller_profiles set review_count = 999
       where profile_id = '00000000-0000-0000-0000-0000000000c2' $$,
  '42501',
  null,
  '自分で review_count は書き換えられない'
);

select throws_ok(
  $$ delete from public.teller_profiles
       where profile_id = '00000000-0000-0000-0000-0000000000c2' $$,
  '42501',
  null,
  '一般ユーザーは占い師登録を削除できない(現在の仕様)'
);

reset role;

-- ---------- 17-19. 削除すると is_teller と active_mode が戻る ----------
-- alice を teller モードにしてから、占い師登録を削除する
update public.profiles set active_mode = 'teller'
  where id = '00000000-0000-0000-0000-0000000000c1';

select lives_ok(
  $$ delete from public.teller_profiles
       where profile_id = '00000000-0000-0000-0000-0000000000c1' $$,
  'teller モードのままでも、占い師登録を削除できる(CHECK 制約に違反しない)'
);

select is(
  (select is_teller from public.profiles
    where id = '00000000-0000-0000-0000-0000000000c1'),
  false,
  '削除されると profiles.is_teller が false に戻る'
);

select is(
  (select active_mode from public.profiles
    where id = '00000000-0000-0000-0000-0000000000c1'),
  'consultant',
  '削除されると active_mode が consultant に戻る'
);

-- ---------- 20. ユーザー削除の連鎖 ----------
select lives_ok(
  $$ delete from auth.users
       where id = '00000000-0000-0000-0000-0000000000c2' $$,
  '占い師のユーザーを削除しても、連鎖削除がエラーにならない'
);

select * from finish();
rollback;