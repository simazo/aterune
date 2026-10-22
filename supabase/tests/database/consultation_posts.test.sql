begin;
select plan(20);

-- ===== テストデータ(postgres 権限) =====
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000c1', 'alice@example.com'),
  ('00000000-0000-0000-0000-0000000000c2', 'bob@example.com');

-- seed に依存しないよう、テスト用のタグを作る(e1=悩みタグ、e2=占術タグ)
insert into public.tags (id, category, slug, name) values
  ('00000000-0000-0000-0000-0000000000e1', 'concern',    'test-concern-a',    'テスト悩みA'),
  ('00000000-0000-0000-0000-0000000000e2', 'divination', 'test-divination-a', 'テスト占術A');

insert into public.consultation_posts (id, consultant_id, concern_tag_id, concern, status) values
  ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000e1', 'aliceの悩み', 'open'),
  ('00000000-0000-0000-0000-0000000000d3', '00000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-0000000000e1', 'bobの悩み',   'open');

-- 1. RLS が有効
select ok(
  (select relrowsecurity from pg_class where oid = 'public.consultation_posts'::regclass),
  'consultation_posts: RLS が有効'
);

-- 2. updated_at 用トリガーが付いている
select has_trigger('public', 'consultation_posts', 'consultation_posts_set_updated_at',
  'consultation_posts: updated_at トリガーがある');

-- ===== anon =====
set local role anon;

-- 3. anon は select できない(一覧は関数経由。投稿者を匿名にするため)
select throws_ok(
  $$ select * from public.consultation_posts $$,
  '42501', null,
  'anon は select できない'
);

-- 4. anon は insert できない
select throws_ok(
  $$ insert into public.consultation_posts (consultant_id, concern_tag_id, concern)
     values ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000e1', 'x') $$,
  '42501', null,
  'anon は insert できない'
);
reset role;

-- ===== authenticated(alice) =====
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}', true);

-- 5. ログイン中でも直接は select できない(consultant_id から投稿者が分かってしまうため)
select throws_ok(
  $$ select id from public.consultation_posts $$,
  '42501', null,
  'authenticated は直接 select できない'
);

-- 6. alice は自分名義で、悩みタグを付けて insert できる
select lives_ok(
  $$ insert into public.consultation_posts (consultant_id, concern_tag_id, concern)
     values ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000e1', '新しい悩み') $$,
  'alice は自分名義の投稿を insert できる'
);

-- 7. alice は他人名義では insert できない
select throws_ok(
  $$ insert into public.consultation_posts (consultant_id, concern_tag_id, concern)
     values ('00000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-0000000000e1', 'なりすまし') $$,
  '42501', null,
  'alice は他人名義の投稿を insert できない'
);

-- 8. alice は insert 時に status を指定できない(列 GRANT)
select throws_ok(
  $$ insert into public.consultation_posts (consultant_id, concern_tag_id, concern, status)
     values ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000e1', 'x', 'closed') $$,
  '42501', null,
  'alice は insert 時に status を指定できない'
);

-- 9. 直接は update できない(閉じるのは close_consultation_post 経由。投稿の編集はできない)
select throws_ok(
  $$ update public.consultation_posts set concern = '更新'
     where id = '00000000-0000-0000-0000-0000000000d1' $$,
  '42501', null,
  'alice は自分の投稿でも直接 update できない'
);

-- 10. 直接は delete できない
select throws_ok(
  $$ delete from public.consultation_posts
     where id = '00000000-0000-0000-0000-0000000000d1' $$,
  '42501', null,
  'alice は自分の投稿でも直接 delete できない'
);

-- 11. 悩みタグ以外のタグは付けられない
select throws_ok(
  $$ insert into public.consultation_posts (consultant_id, concern_tag_id, concern)
     values ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000e2', 'x') $$,
  'P0001', 'the tag is not a concern tag',
  '悩みタグ以外のタグでは投稿できない'
);

-- 12. 本文は1000文字まで
select lives_ok(
  $$ insert into public.consultation_posts (consultant_id, concern_tag_id, concern)
     values ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000e1', repeat('あ', 1000)) $$,
  '本文は1000文字なら投稿できる'
);

-- 13. 1001文字は弾く(セッションにコピーするときに sessions の上限で落ちないよう揃える)
select throws_ok(
  $$ insert into public.consultation_posts (consultant_id, concern_tag_id, concern)
     values ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000e1', repeat('あ', 1001)) $$,
  '23514', null,
  '本文が1001文字なら投稿できない'
);
reset role;

-- ===== 制約(postgres 権限) =====
-- 14. status に想定外の値は入らない
select throws_ok(
  $$ insert into public.consultation_posts (consultant_id, concern_tag_id, concern, status)
     values ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000e1', 'x', 'resolved') $$,
  '23514', null,
  'status は open / in_progress / closed 以外を入れられない'
);

-- 15. concern は NOT NULL
select throws_ok(
  $$ insert into public.consultation_posts (consultant_id, concern_tag_id, concern)
     values ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000e1', null) $$,
  '23502', null,
  'concern は NULL にできない'
);

-- 16. concern_tag_id は NOT NULL(悩みタグは必須)
select throws_ok(
  $$ insert into public.consultation_posts (consultant_id, concern_tag_id, concern)
     values ('00000000-0000-0000-0000-0000000000c1', null, 'x') $$,
  '23502', null,
  'concern_tag_id は NULL にできない'
);

-- 17. 存在しない consultant_id は外部キー違反
select throws_ok(
  $$ insert into public.consultation_posts (consultant_id, concern_tag_id, concern)
     values (gen_random_uuid(), '00000000-0000-0000-0000-0000000000e1', 'x') $$,
  '23503', null,
  '存在しない consultant_id は外部キー違反'
);

-- 18. 存在しないタグは外部キー違反
select throws_ok(
  $$ insert into public.consultation_posts (consultant_id, concern_tag_id, concern)
     values ('00000000-0000-0000-0000-0000000000c1', gen_random_uuid(), 'x') $$,
  '23503', null,
  '存在しない concern_tag_id は外部キー違反'
);

-- 19. タグを悩みタグ以外に変えることもできない(システムからの更新でも弾く)
select throws_ok(
  $$ update public.consultation_posts set concern_tag_id = '00000000-0000-0000-0000-0000000000e2'
     where id = '00000000-0000-0000-0000-0000000000d1' $$,
  'P0001', 'the tag is not a concern tag',
  '悩みタグ以外のタグに変えられない'
);

-- 20. タグのチェック関数はトリガー専用で、API から呼べない
select is(
  has_function_privilege('authenticated', 'public.check_post_concern_tag()', 'execute'),
  false, 'authenticated は check_post_concern_tag を実行できない'
);

select * from finish();
rollback;
