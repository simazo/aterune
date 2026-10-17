begin;
select plan(18);

-- ===== テストデータ(postgres 権限)=====
-- seed に依存しないよう、タグ・占い師はすべてここで作る。結果はテストの占い師(d1〜d4)に絞って確かめる
-- d1: 占術1・スタイル1 / d2: 占術2・スタイル2 / d3: 占術1・占術2(受付停止中)/ d4: タグなし / d5: 占い師ではない
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000d1', 'd1@example.com', '{"display_name":"テスト占い師1"}'),
  ('00000000-0000-0000-0000-0000000000d2', 'd2@example.com', '{"display_name":"テスト占い師2"}'),
  ('00000000-0000-0000-0000-0000000000d3', 'd3@example.com', '{"display_name":"テスト占い師3"}'),
  ('00000000-0000-0000-0000-0000000000d4', 'd4@example.com', '{"display_name":"テスト占い師4"}'),
  ('00000000-0000-0000-0000-0000000000d5', 'd5@example.com', '{"display_name":"一般ユーザー"}');

insert into public.teller_profiles (profile_id, self_pr, training_period, is_accepting) values
  ('00000000-0000-0000-0000-0000000000d1', 'd1 の自己PR', '半年', true),
  ('00000000-0000-0000-0000-0000000000d2', 'd2 の自己PR', null,   true),
  ('00000000-0000-0000-0000-0000000000d3', 'd3 の自己PR', '3年',  false),
  ('00000000-0000-0000-0000-0000000000d4', 'd4 の自己PR', null,   true);

-- キャッシュ値は postgres 権限で直接入れる(結果の列に載ることの確認用)
update public.teller_profiles
   set average_rating = 4.50, review_count = 2, session_count = 3
 where profile_id = '00000000-0000-0000-0000-0000000000d1';

-- 占術2 の表示順を占術1 より前にして、tags の並び順を確かめられるようにする
insert into public.tags (id, category, slug, name, sort_order) values
  ('00000000-0000-0000-0000-000000000d01', 'divination', 'test-div-1',   'テスト占術1',     2),
  ('00000000-0000-0000-0000-000000000d02', 'divination', 'test-div-2',   'テスト占術2',     1),
  ('00000000-0000-0000-0000-000000000d03', 'style',      'test-style-1', 'テストスタイル1', 1),
  ('00000000-0000-0000-0000-000000000d04', 'style',      'test-style-2', 'テストスタイル2', 2);

insert into public.teller_tags (teller_id, tag_id) values
  ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-000000000d01'),
  ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-000000000d03'),
  ('00000000-0000-0000-0000-0000000000d2', '00000000-0000-0000-0000-000000000d02'),
  ('00000000-0000-0000-0000-0000000000d2', '00000000-0000-0000-0000-000000000d04'),
  ('00000000-0000-0000-0000-0000000000d3', '00000000-0000-0000-0000-000000000d01'),
  ('00000000-0000-0000-0000-0000000000d3', '00000000-0000-0000-0000-000000000d02');

-- テストの占い師だけに絞って teller_id を返す
create temporary view test_tellers as
  select unnest(array[
    '00000000-0000-0000-0000-0000000000d1',
    '00000000-0000-0000-0000-0000000000d2',
    '00000000-0000-0000-0000-0000000000d3',
    '00000000-0000-0000-0000-0000000000d4',
    '00000000-0000-0000-0000-0000000000d5'
  ]::uuid[]) as id;
grant select on test_tellers to anon, authenticated;

-- 1-2. 実行権限
select ok(
  has_function_privilege('anon', 'public.search_tellers(text[], boolean)', 'execute'),
  'anon は search_tellers を実行できる'
);
select ok(
  has_function_privilege('authenticated', 'public.search_tellers(text[], boolean)', 'execute'),
  'authenticated は search_tellers を実行できる'
);

-- ===== 未ログイン(anon)=====
set local role anon;

-- 3. タグ指定なしなら全員(受付停止中・タグなしも含む)
select set_eq(
  $$ select teller_id from public.search_tellers() where teller_id in (select id from test_tellers) $$,
  array[
    '00000000-0000-0000-0000-0000000000d1',
    '00000000-0000-0000-0000-0000000000d2',
    '00000000-0000-0000-0000-0000000000d3',
    '00000000-0000-0000-0000-0000000000d4'
  ]::uuid[],
  'タグを指定しなければ、全占い師を返す(受付停止中も含む)'
);

-- 4. 占い師登録の無いユーザーは返さない
select is(
  (select count(*)::int from public.search_tellers()
    where teller_id = '00000000-0000-0000-0000-0000000000d5'),
  0,
  '占い師登録の無いユーザーは返さない'
);

-- 5. タグ1つ
select set_eq(
  $$ select teller_id from public.search_tellers(array['test-div-1']) where teller_id in (select id from test_tellers) $$,
  array[
    '00000000-0000-0000-0000-0000000000d1',
    '00000000-0000-0000-0000-0000000000d3'
  ]::uuid[],
  'タグを1つ指定すると、そのタグを持つ占い師だけを返す'
);

-- 6. 同じ種類のタグは OR
select set_eq(
  $$ select teller_id from public.search_tellers(array['test-div-1', 'test-div-2']) where teller_id in (select id from test_tellers) $$,
  array[
    '00000000-0000-0000-0000-0000000000d1',
    '00000000-0000-0000-0000-0000000000d2',
    '00000000-0000-0000-0000-0000000000d3'
  ]::uuid[],
  '同じ種類のタグを複数指定すると、どれかを持つ占い師を返す(OR)'
);

-- 7. 種類が違うタグは AND
select set_eq(
  $$ select teller_id from public.search_tellers(array['test-div-1', 'test-style-1']) where teller_id in (select id from test_tellers) $$,
  array['00000000-0000-0000-0000-0000000000d1']::uuid[],
  '種類の違うタグを指定すると、すべての種類を満たす占い師だけを返す(AND)'
);

-- 8. 存在しない slug は無視
select set_eq(
  $$ select teller_id from public.search_tellers(array['test-div-1', 'no-such-tag']) where teller_id in (select id from test_tellers) $$,
  array[
    '00000000-0000-0000-0000-0000000000d1',
    '00000000-0000-0000-0000-0000000000d3'
  ]::uuid[],
  '存在しない slug は無視する'
);

-- 9. 絞り込みに使っていないタグも含めて、全タグを返す
select is(
  (select tags from public.search_tellers(array['test-div-1'])
    where teller_id = '00000000-0000-0000-0000-0000000000d1'),
  '[{"slug": "test-div-1",   "category": "divination", "name": "テスト占術1"},
    {"slug": "test-style-1", "category": "style",      "name": "テストスタイル1"}]'::jsonb,
  'tags には、絞り込みに使っていないタグも含めて全タグが入る'
);

-- 10. tags は種類 → 表示順の順
select is(
  (select tags from public.search_tellers()
    where teller_id = '00000000-0000-0000-0000-0000000000d3'),
  '[{"slug": "test-div-2", "category": "divination", "name": "テスト占術2"},
    {"slug": "test-div-1", "category": "divination", "name": "テスト占術1"}]'::jsonb,
  'tags は種類 → 表示順(sort_order)の順に並ぶ'
);

-- 11. タグの無い占い師は空配列
select is(
  (select tags from public.search_tellers()
    where teller_id = '00000000-0000-0000-0000-0000000000d4'),
  '[]'::jsonb,
  'タグの無い占い師の tags は空配列'
);

-- 12. カード表示用の列
select results_eq(
  $$ select display_name, self_pr, training_period, is_accepting, average_rating, review_count, session_count
       from public.search_tellers()
      where teller_id = '00000000-0000-0000-0000-0000000000d1' $$,
  $$ values ('テスト占い師1'::text, 'd1 の自己PR'::text, '半年'::text, true, 4.50::numeric, 2, 3) $$,
  '表示名・自己PR・修行期間・受付状態・評価・レビュー数・完了セッション数を返す'
);

-- 13. 受付停止中の占い師の is_accepting は false
select is(
  (select is_accepting from public.search_tellers()
    where teller_id = '00000000-0000-0000-0000-0000000000d3'),
  false,
  '受付停止中の占い師も返し、is_accepting は false'
);

-- 14. 受付中のみ
select set_eq(
  $$ select teller_id from public.search_tellers('{}', true) where teller_id in (select id from test_tellers) $$,
  array[
    '00000000-0000-0000-0000-0000000000d1',
    '00000000-0000-0000-0000-0000000000d2',
    '00000000-0000-0000-0000-0000000000d4'
  ]::uuid[],
  'p_accepting_only が true なら、受付停止中の占い師を返さない'
);

-- 15. 明示的に false なら受付停止中も含む
select set_eq(
  $$ select teller_id from public.search_tellers('{}', false) where teller_id in (select id from test_tellers) $$,
  array[
    '00000000-0000-0000-0000-0000000000d1',
    '00000000-0000-0000-0000-0000000000d2',
    '00000000-0000-0000-0000-0000000000d3',
    '00000000-0000-0000-0000-0000000000d4'
  ]::uuid[],
  'p_accepting_only が false なら、受付停止中の占い師も返す'
);

-- 16. タグの絞り込みと組み合わせる
select set_eq(
  $$ select teller_id from public.search_tellers(array['test-div-1'], true) where teller_id in (select id from test_tellers) $$,
  array['00000000-0000-0000-0000-0000000000d1']::uuid[],
  'タグと受付中のみを組み合わせると、両方を満たす占い師だけを返す'
);

reset role;

-- ===== ログイン中の占い師(d1)=====
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000d1","role":"authenticated"}', true);

-- 17. 自分自身は返さない
select set_eq(
  $$ select teller_id from public.search_tellers() where teller_id in (select id from test_tellers) $$,
  array[
    '00000000-0000-0000-0000-0000000000d2',
    '00000000-0000-0000-0000-0000000000d3',
    '00000000-0000-0000-0000-0000000000d4'
  ]::uuid[],
  'ログイン中の占い師には、自分自身を返さない'
);

-- 18. ログイン中でもタグの絞り込みは効く
select set_eq(
  $$ select teller_id from public.search_tellers(array['test-div-1']) where teller_id in (select id from test_tellers) $$,
  array['00000000-0000-0000-0000-0000000000d3']::uuid[],
  'ログイン中でも、自分を除いたうえでタグで絞り込む'
);

reset role;

select * from finish();
rollback;
