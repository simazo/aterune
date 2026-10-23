begin;
select plan(26);

-- ===== テストデータ(postgres 権限)=====
-- alice=これから占い師登録する人 / bob=登録済みの占い師(alice の操作に巻き込まれないことの確認用)
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'alice@example.com'),
  ('00000000-0000-0000-0000-0000000000b2', 'bob@example.com');

insert into public.tags (id, category, slug, name) values
  ('00000000-0000-0000-0000-0000000000d1', 'divination', 'test-divination-1', 'テスト占術1'),
  ('00000000-0000-0000-0000-0000000000d2', 'divination', 'test-divination-2', 'テスト占術2'),
  ('00000000-0000-0000-0000-0000000000c1', 'concern',    'test-concern-1',    'テスト悩み1');

insert into public.teller_profiles (profile_id, self_pr, training_period) values
  ('00000000-0000-0000-0000-0000000000b2', 'bob の自己PR', '1年');
insert into public.teller_tags (teller_id, tag_id) values
  ('00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-0000000000d1');

-- 1-3. 実行権限と security definer
select ok(
  not has_function_privilege('anon', 'public.save_teller_profile(text, text, boolean, boolean, uuid[])', 'execute'),
  'anon は save_teller_profile を実行できない'
);
select ok(
  has_function_privilege('authenticated', 'public.save_teller_profile(text, text, boolean, boolean, uuid[])', 'execute'),
  'authenticated は save_teller_profile を実行できる'
);
-- teller_profiles の insert と teller_tags の insert / delete は直接できないため、definer で書き込む。
-- RLS が効かないので、他の占い師に触れないことは 25-26 で確かめる
select ok(
  (select prosecdef from pg_proc
    where oid = 'public.save_teller_profile(text, text, boolean, boolean, uuid[])'::regprocedure),
  'save_teller_profile は security definer'
);

-- ===== 未ログイン(auth.uid() が null)=====
set local role authenticated;
select set_config('request.jwt.claims', '{"role":"authenticated"}', true);

-- 4. 未ログインでは呼べない
select throws_ok(
  $$ select public.save_teller_profile(null, null, false, true,
       array['00000000-0000-0000-0000-0000000000d1']::uuid[]) $$,
  '42501', null, '未ログインでは save_teller_profile を呼べない'
);
reset role;

-- ===== alice =====
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);

-- 5-11. 占術タグが無い・必須の値が null なら登録できない(何も残らない)
select throws_ok(
  $$ select public.save_teller_profile(null, null, false, true,
       array['00000000-0000-0000-0000-0000000000c1']::uuid[]) $$,
  'P0001', null, '占術タグが無ければエラーになる(悩みタグだけ)'
);
select throws_ok(
  $$ select public.save_teller_profile(null, null, false, true, array[]::uuid[]) $$,
  'P0001', null, '占術タグが無ければエラーになる(タグなし)'
);
select throws_ok(
  $$ select public.save_teller_profile(null, null, false, true, null) $$,
  'P0001', null, '占術タグが無ければエラーになる(タグの配列が null)'
);
-- 列の初期値で補わず、エラーにする(アプリは常に値を渡すため、null は不具合として気づけるようにする)
select throws_ok(
  $$ select public.save_teller_profile(null, null, false, null,
       array['00000000-0000-0000-0000-0000000000d1']::uuid[]) $$,
  '23502', null, 'is_accepting が null ならエラーになる'
);
select throws_ok(
  $$ select public.save_teller_profile(null, null, null, true,
       array['00000000-0000-0000-0000-0000000000d1']::uuid[]) $$,
  '23502', null, 'requires_birthdate が null ならエラーになる'
);
select throws_ok(
  $$ select public.save_teller_profile(null, null, false, true,
       array['00000000-0000-0000-0000-0000000000d1', null]::uuid[]) $$,
  '23502', null, 'タグの配列に null が含まれるとエラーになる'
);
select is(
  (select count(*)::int from public.teller_profiles where profile_id = '00000000-0000-0000-0000-0000000000a1'),
  0, '登録に失敗したときは、占い師プロフィールは作られない(タグまで進んだ後の失敗も含む)'
);

-- 12-15. 初回の呼び出しで登録される
select lives_ok(
  $$ select public.save_teller_profile('自己PR', '半年', true, false,
       array['00000000-0000-0000-0000-0000000000d1',
             '00000000-0000-0000-0000-0000000000c1']::uuid[]) $$,
  '占術タグがあれば占い師として登録できる'
);
select is(
  (select is_teller from public.profiles where id = '00000000-0000-0000-0000-0000000000a1'),
  true, '登録すると is_teller が true になる'
);
select results_eq(
  $$ select self_pr, training_period, requires_birthdate, is_accepting
       from public.teller_profiles where profile_id = '00000000-0000-0000-0000-0000000000a1' $$,
  $$ values ('自己PR'::text, '半年'::text, true, false) $$,
  '渡した内容で占い師プロフィールが作られる'
);
select results_eq(
  $$ select tag_id from public.teller_tags
      where teller_id = '00000000-0000-0000-0000-0000000000a1' order by tag_id $$,
  $$ values ('00000000-0000-0000-0000-0000000000c1'::uuid),
            ('00000000-0000-0000-0000-0000000000d1'::uuid) $$,
  '渡したタグが付く'
);
reset role;

-- 集計値が上書きされないことの確認用に、システム側で値を入れておく
update public.teller_profiles set session_count = 3
  where profile_id = '00000000-0000-0000-0000-0000000000a1';

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);

-- 16-20. 2回目の呼び出しで更新され、タグが入れ替わる
select lives_ok(
  $$ select public.save_teller_profile(null, null, false, true,
       array['00000000-0000-0000-0000-0000000000d2']::uuid[]) $$,
  '登録済みなら占い師プロフィールを更新できる'
);
select results_eq(
  $$ select self_pr, training_period, requires_birthdate, is_accepting, session_count
       from public.teller_profiles where profile_id = '00000000-0000-0000-0000-0000000000a1' $$,
  $$ values (null::text, null::text, false, true, 3) $$,
  '更新すると渡した内容になり、集計値(session_count)はそのまま残る'
);
select results_eq(
  $$ select tag_id from public.teller_tags
      where teller_id = '00000000-0000-0000-0000-0000000000a1' $$,
  $$ values ('00000000-0000-0000-0000-0000000000d2'::uuid) $$,
  '更新するとタグが渡したものだけに入れ替わる'
);
select lives_ok(
  $$ select public.save_teller_profile(null, null, false, true,
       array['00000000-0000-0000-0000-0000000000d2',
             '00000000-0000-0000-0000-0000000000d2']::uuid[]) $$,
  '同じタグが重複して渡されてもエラーにならない'
);
select is(
  (select count(*)::int from public.teller_tags
    where teller_id = '00000000-0000-0000-0000-0000000000a1'),
  1, '同じタグが重複して渡されても、付くのは1行だけ'
);

-- 21-24. 途中で失敗したら全体が取り消される
select throws_ok(
  $$ select public.save_teller_profile('書き換え', null, false, true,
       array['00000000-0000-0000-0000-0000000000d1',
             '00000000-0000-0000-0000-0000000000ff']::uuid[]) $$,
  '23503', null, '存在しないタグが含まれるとエラーになる'
);
select results_eq(
  $$ select tag_id from public.teller_tags
      where teller_id = '00000000-0000-0000-0000-0000000000a1' $$,
  $$ values ('00000000-0000-0000-0000-0000000000d2'::uuid) $$,
  '存在しないタグで失敗したときは、タグが元のまま残る'
);
select is(
  (select self_pr from public.teller_profiles where profile_id = '00000000-0000-0000-0000-0000000000a1'),
  null, '存在しないタグで失敗したときは、プロフィールも元のまま残る'
);
select throws_ok(
  $$ select public.save_teller_profile(repeat('あ', 1001), null, false, true,
       array['00000000-0000-0000-0000-0000000000d1']::uuid[]) $$,
  '23514', null, 'self_pr が 1001 文字以上ならエラーになる'
);
reset role;

-- 25-26. 他の占い師には影響しない
select results_eq(
  $$ select tag_id from public.teller_tags
      where teller_id = '00000000-0000-0000-0000-0000000000b2' $$,
  $$ values ('00000000-0000-0000-0000-0000000000d1'::uuid) $$,
  '他の占い師のタグは変わらない'
);
select results_eq(
  $$ select self_pr, training_period, requires_birthdate, is_accepting
       from public.teller_profiles where profile_id = '00000000-0000-0000-0000-0000000000b2' $$,
  $$ values ('bob の自己PR'::text, '1年'::text, false, true) $$,
  '他の占い師のプロフィールは変わらない'
);

select * from finish();
rollback;
