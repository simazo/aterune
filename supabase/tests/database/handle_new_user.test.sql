begin;
select plan(8);

-- ---------- 準備: auth.users に insert するだけ(profiles は触らない) ----------
insert into auth.users (id, aud, role, email, raw_user_meta_data) values
  -- メタデータあり
  ('00000000-0000-0000-0000-0000000000b1', 'authenticated', 'authenticated',
   'alice@example.com', '{"display_name":"Alice"}'),
  -- メタデータなし、メールあり
  ('00000000-0000-0000-0000-0000000000b2', 'authenticated', 'authenticated',
   'bob@example.com', '{}'),
  -- メタデータなし、メールもなし
  ('00000000-0000-0000-0000-0000000000b3', 'authenticated', 'authenticated',
   null, '{}');

-- ---------- 1. トリガーが付いているか ----------
select has_trigger('auth', 'users', 'on_auth_user_created',
  'auth.users に profiles 自動作成用のトリガーが付いている');

-- ---------- 2-4. display_name の決まり方 ----------
select is(
  (select display_name from public.profiles
    where id = '00000000-0000-0000-0000-0000000000b1'),
  'Alice',
  'メタデータの display_name が使われる'
);

select is(
  (select display_name from public.profiles
    where id = '00000000-0000-0000-0000-0000000000b2'),
  'bob',
  'メタデータがなければ、メールの @ より前が使われる'
);

select is(
  (select display_name from public.profiles
    where id = '00000000-0000-0000-0000-0000000000b3'),
  'ユーザー',
  'どちらもなければ、固定の名前が使われる(サインアップが失敗しない)'
);

-- ---------- 5-6. 初期値 ----------
select is(
  (select is_teller from public.profiles
    where id = '00000000-0000-0000-0000-0000000000b1'),
  false,
  '初期状態は is_teller = false'
);

select is(
  (select active_mode from public.profiles
    where id = '00000000-0000-0000-0000-0000000000b1'),
  'consultant',
  '初期状態は active_mode = consultant'
);

-- ---------- 7-8. API から直接呼べないこと ----------
select is(
  has_function_privilege('anon', 'public.handle_new_user()', 'execute'),
  false,
  'anon は handle_new_user を実行できない'
);

select is(
  has_function_privilege('authenticated', 'public.handle_new_user()', 'execute'),
  false,
  'authenticated は handle_new_user を実行できない'
);

select * from finish();
rollback;