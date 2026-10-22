begin;
select plan(10);

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

-- 表示名の上限(20 文字)と空白だけの表示名で、サインアップが失敗しないことの確認用
insert into auth.users (id, aud, role, email, raw_user_meta_data) values
  -- メタデータの表示名が 21 文字
  ('00000000-0000-0000-0000-0000000000b4', 'authenticated', 'authenticated',
   'carol@example.com', jsonb_build_object('display_name', repeat('あ', 21))),
  -- メタデータの表示名が全角スペースだけ
  ('00000000-0000-0000-0000-0000000000b5', 'authenticated', 'authenticated',
   'dave@example.com', '{"display_name":"　"}'),
  -- メタデータなし、メールの @ より前が 21 文字
  ('00000000-0000-0000-0000-0000000000b6', 'authenticated', 'authenticated',
   repeat('e', 21) || '@example.com', '{}');

-- ---------- 1. トリガーが付いているか ----------
select has_trigger('auth', 'users', 'on_auth_user_created',
  'auth.users に profiles 自動作成用のトリガーが付いている');

-- ---------- 2-7. display_name の決まり方 ----------
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

select is(
  (select display_name from public.profiles
    where id = '00000000-0000-0000-0000-0000000000b4'),
  repeat('あ', 20),
  'メタデータの display_name が 21 文字以上なら、20 文字に切り詰められる'
);

select is(
  (select display_name from public.profiles
    where id = '00000000-0000-0000-0000-0000000000b5'),
  'dave',
  'メタデータの display_name が全角スペースだけなら、メールの @ より前が使われる'
);

select is(
  (select display_name from public.profiles
    where id = '00000000-0000-0000-0000-0000000000b6'),
  repeat('e', 20),
  'メールの @ より前が 21 文字以上なら、20 文字に切り詰められる'
);

-- ---------- 8. 初期値 ----------
select is(
  (select is_teller from public.profiles
    where id = '00000000-0000-0000-0000-0000000000b1'),
  false,
  '初期状態は is_teller = false'
);

-- ---------- 9-10. API から直接呼べないこと ----------
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