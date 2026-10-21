begin;
select plan(8);

-- ---------- 準備 ----------
-- profiles は handle_new_user のトリガーで自動作成される
insert into auth.users (id, aud, role, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'authenticated', 'authenticated', 'alice@example.com'),
  ('00000000-0000-0000-0000-0000000000a2', 'authenticated', 'authenticated', 'bob@example.com');
  
-- ---------- 1. RLS が有効か ----------
select is(
  (select relrowsecurity from pg_class where oid = 'public.profiles'::regclass),
  true,
  'profiles は RLS が有効'
);

-- ---------- 2. updated_at 用のトリガーが付いているか ----------
select has_trigger('public', 'profiles', 'profiles_set_updated_at',
  'profiles に updated_at 用のトリガーが付いている');

-- ---------- 3-4. anon(未ログイン) ----------
set local role anon;

-- seed などテスト外の行に左右されないよう、テストで入れた行だけを数える
select is(
  (select count(*)::int from public.profiles
    where id in ('00000000-0000-0000-0000-0000000000a1',
                 '00000000-0000-0000-0000-0000000000a2')),
  2,
  'anon は全プロフィールを読める'
);

select throws_ok(
  $$ insert into public.profiles (id, display_name)
       values ('00000000-0000-0000-0000-0000000000a3', 'x') $$,
  '42501',
  null,
  'anon は INSERT できない'
);

reset role;

-- ---------- 5-8. authenticated(alice としてログイン) ----------
set local role authenticated;
set local request.jwt.claims =
  '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}';

select lives_ok(
  $$ update public.profiles set bio = 'mine'
       where id = '00000000-0000-0000-0000-0000000000a1' $$,
  '自分のプロフィールは更新できる'
);

select results_eq(
  $$ with u as (
       update public.profiles set bio = 'hacked'
         where id = '00000000-0000-0000-0000-0000000000a2' returning 1
     ) select count(*)::int from u $$,
  array[0],
  '他人のプロフィールは更新できない(0行)'
);

select throws_ok(
  $$ insert into public.profiles (id, display_name)
       values ('00000000-0000-0000-0000-0000000000a3', 'x') $$,
  '42501',
  null,
  '他人の id では INSERT できない'
);

select throws_ok(
  $$ update public.profiles set is_teller = true
       where id = '00000000-0000-0000-0000-0000000000a1' $$,
  '42501',
  null,
  '自分で is_teller は書き換えられない'
);

select * from finish();
rollback;