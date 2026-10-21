begin;
select plan(11);

-- ===== テストデータ(postgres 権限)=====
-- bob が同じ端末で使っていた token(shared-token)と、別端末の token(bob-other)を持っている
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000c1', 'carol@example.com'),
  ('00000000-0000-0000-0000-0000000000b2', 'bob@example.com');

insert into public.push_tokens (user_id, expo_push_token, platform) values
  ('00000000-0000-0000-0000-0000000000b2', 'shared-token', 'android'),
  ('00000000-0000-0000-0000-0000000000b2', 'bob-other',    'android');

-- 1-3. 実行権限と security definer
select ok(
  not has_function_privilege('anon', 'public.register_push_token(text, text)', 'execute'),
  'anon は register_push_token を実行できない'
);
select ok(
  has_function_privilege('authenticated', 'public.register_push_token(text, text)', 'execute'),
  'authenticated は register_push_token を実行できる'
);
select ok(
  (select prosecdef from pg_proc where oid = 'public.register_push_token(text, text)'::regprocedure),
  'register_push_token は security definer'
);

-- ===== anon =====
set local role anon;

-- 4. anon は呼べない
select throws_ok(
  $$ select public.register_push_token('anon-token', 'ios') $$,
  '42501', null, 'anon は register_push_token を呼べない'
);
reset role;

-- ===== 未ログイン(auth.uid() が null)=====
set local role authenticated;
select set_config('request.jwt.claims', '{"role":"authenticated"}', true);

-- 5. auth.uid() が null なら例外
select throws_ok(
  $$ select public.register_push_token('no-user-token', 'ios') $$,
  '42501', 'ログインが必要です', 'auth.uid() が null なら register_push_token は例外になる'
);
reset role;

-- ===== carol が同じ端末(shared-token)でログイン =====
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}', true);

-- 6. 他人が持っている token でも登録できる
select lives_ok(
  $$ select public.register_push_token('shared-token', 'ios') $$,
  '他のユーザーが持っている token でも登録できる'
);
reset role;

-- 7. 同じ token は carol の1行だけになる(bob から carol に持ち主が付け替わる)
select results_eq(
  $$ select user_id, platform from public.push_tokens where expo_push_token = 'shared-token' $$,
  $$ values ('00000000-0000-0000-0000-0000000000c1'::uuid, 'ios'::text) $$,
  '同じ token を持つ他のユーザーの行は、持ち主が自分に付け替わる'
);

-- 8. bob の別の token は消えない
select is(
  (select count(*)::int from public.push_tokens
    where user_id = '00000000-0000-0000-0000-0000000000b2' and expo_push_token = 'bob-other'),
  1, '他のユーザーの別の token は消えない'
);

-- ===== carol が同じ token をもう一度登録 =====
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}', true);
select public.register_push_token('shared-token', 'android');
reset role;

-- 9. 行は1つのまま
select is(
  (select count(*)::int from public.push_tokens where expo_push_token = 'shared-token'),
  1, '同じ token をもう一度登録しても行は1つのまま'
);

-- 10. platform は最後に登録した値になる
select is(
  (select platform from public.push_tokens where expo_push_token = 'shared-token'),
  'android', 'もう一度登録すると platform が更新される'
);

-- ===== 値のチェック(テーブルの CHECK 制約が効く)=====
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}', true);

-- 11. 空の token は登録できない
select throws_ok(
  $$ select public.register_push_token('', 'ios') $$,
  '23514', null, '空の token は register_push_token で登録できない'
);
reset role;

select * from finish();
rollback;
