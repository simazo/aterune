begin;
select plan(26);

-- ===== テストデータ(postgres 権限)=====
-- seed に依存しないよう、タグ・占い師はすべてここで作る。結果はテストの占い師(d1〜d4)に絞って確かめる
-- d1: 占術1・悩み1・スタイル1 / d2: 占術2・悩み1・スタイル2 / d3: 占術1・占術2(受付停止中)/ d4: タグなし / d5: 占い師ではない
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

-- キャッシュ値と登録日時は postgres 権限で直接入れる(結果の列・並び順の確認用)。
-- 同じトランザクション内では now() が同じになるため、created_at は日をずらして入れる
--        評価  レビュー数  セッション数  登録
--   d1:  4.50  2           3             4日前
--   d2:  3.00  1           10            3日前
--   d3:  なし  0           0             2日前
--   d4:  4.50  1           3             1日前
-- 評価順はベイズ平均 (3 × 4.0 + 平均 × レビュー数) ÷ (3 + レビュー数) の高い順:
--   d1: (12 + 9.0) ÷ 5 = 4.20 / d4: (12 + 4.5) ÷ 4 = 4.125 / d2: (12 + 3.0) ÷ 4 = 3.75
-- 新着順: d4, d3, d2, d1 / 評価順: d1, d4(平均は同じでもレビュー数の多い方が上), d2, d3(評価なしは最後)
-- セッション数順: d2, d4, d1(同数は新しい順), d3
update public.teller_profiles as tp
   set average_rating = v.average_rating,
       review_count   = v.review_count,
       session_count  = v.session_count,
       created_at     = now() - v.days_ago * interval '1 day'
  from (values
    ('00000000-0000-0000-0000-0000000000d1'::uuid, 4.50, 2, 3,  4),
    ('00000000-0000-0000-0000-0000000000d2'::uuid, 3.00, 1, 10, 3),
    ('00000000-0000-0000-0000-0000000000d3'::uuid, null, 0, 0,  2),
    ('00000000-0000-0000-0000-0000000000d4'::uuid, 4.50, 1, 3,  1)
  ) as v (profile_id, average_rating, review_count, session_count, days_ago)
 where tp.profile_id = v.profile_id;

-- アイコンは d1 だけに入れる(列の確認用)
update public.profiles
   set avatar_path = '00000000-0000-0000-0000-0000000000d1/1730000000000.jpg'
 where id = '00000000-0000-0000-0000-0000000000d1';

-- 占術2 の表示順を占術1 より前にして、tags の並び順を確かめられるようにする
insert into public.tags (id, category, slug, name, sort_order) values
  ('00000000-0000-0000-0000-000000000d01', 'divination', 'test-div-1',     'テスト占術1',     2),
  ('00000000-0000-0000-0000-000000000d02', 'divination', 'test-div-2',     'テスト占術2',     1),
  ('00000000-0000-0000-0000-000000000d03', 'style',      'test-style-1',   'テストスタイル1', 1),
  ('00000000-0000-0000-0000-000000000d04', 'style',      'test-style-2',   'テストスタイル2', 2),
  ('00000000-0000-0000-0000-000000000d05', 'concern',    'test-concern-1', 'テスト悩み1',     1);

insert into public.teller_tags (teller_id, tag_id) values
  ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-000000000d01'),
  ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-000000000d03'),
  ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-000000000d05'),
  ('00000000-0000-0000-0000-0000000000d2', '00000000-0000-0000-0000-000000000d02'),
  ('00000000-0000-0000-0000-0000000000d2', '00000000-0000-0000-0000-000000000d04'),
  ('00000000-0000-0000-0000-0000000000d2', '00000000-0000-0000-0000-000000000d05'),
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
  has_function_privilege('anon', 'public.search_tellers(text[], boolean, public.teller_sort_order)', 'execute'),
  'anon は search_tellers を実行できる'
);
select ok(
  has_function_privilege('authenticated', 'public.search_tellers(text[], boolean, public.teller_sort_order)', 'execute'),
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

-- 8. 悩みタグも、ほかの種類のタグと AND で組み合わせる
select set_eq(
  $$ select teller_id from public.search_tellers(array['test-div-1', 'test-concern-1']) where teller_id in (select id from test_tellers) $$,
  array['00000000-0000-0000-0000-0000000000d1']::uuid[],
  '悩みタグと占術タグを指定すると、両方を持つ占い師だけを返す(AND)'
);

-- 9. 存在しない slug は無視
select set_eq(
  $$ select teller_id from public.search_tellers(array['test-div-1', 'no-such-tag']) where teller_id in (select id from test_tellers) $$,
  array[
    '00000000-0000-0000-0000-0000000000d1',
    '00000000-0000-0000-0000-0000000000d3'
  ]::uuid[],
  '存在しない slug は無視する'
);

-- 10. 絞り込みに使っていないタグも含めて、全タグを返す
select is(
  (select tags from public.search_tellers(array['test-div-1'])
    where teller_id = '00000000-0000-0000-0000-0000000000d1'),
  '[{"slug": "test-div-1",     "category": "divination", "name": "テスト占術1"},
    {"slug": "test-concern-1", "category": "concern",    "name": "テスト悩み1"},
    {"slug": "test-style-1",   "category": "style",      "name": "テストスタイル1"}]'::jsonb,
  'tags には、絞り込みに使っていないタグも含めて全タグが入る(種類は占術 → 悩み → スタイルの順)'
);

-- 11. tags は種類 → 表示順の順
select is(
  (select tags from public.search_tellers()
    where teller_id = '00000000-0000-0000-0000-0000000000d3'),
  '[{"slug": "test-div-2", "category": "divination", "name": "テスト占術2"},
    {"slug": "test-div-1", "category": "divination", "name": "テスト占術1"}]'::jsonb,
  'tags は種類 → 表示順(sort_order)の順に並ぶ'
);

-- 12. タグの無い占い師は空配列
select is(
  (select tags from public.search_tellers()
    where teller_id = '00000000-0000-0000-0000-0000000000d4'),
  '[]'::jsonb,
  'タグの無い占い師の tags は空配列'
);

-- 13. カード表示用の列
select results_eq(
  $$ select display_name, avatar_path, self_pr, training_period, is_accepting, average_rating, review_count, session_count
       from public.search_tellers()
      where teller_id = '00000000-0000-0000-0000-0000000000d1' $$,
  $$ values ('テスト占い師1'::text, '00000000-0000-0000-0000-0000000000d1/1730000000000.jpg'::text,
             'd1 の自己PR'::text, '半年'::text, true, 4.50::numeric, 2, 3) $$,
  '表示名・アイコンのパス・自己PR・修行期間・受付状態・評価・レビュー数・完了セッション数を返す'
);

-- 14. 受付停止中の占い師の is_accepting は false
select is(
  (select is_accepting from public.search_tellers()
    where teller_id = '00000000-0000-0000-0000-0000000000d3'),
  false,
  '受付停止中の占い師も返し、is_accepting は false'
);

-- 15. 受付中のみ
select set_eq(
  $$ select teller_id from public.search_tellers('{}', true) where teller_id in (select id from test_tellers) $$,
  array[
    '00000000-0000-0000-0000-0000000000d1',
    '00000000-0000-0000-0000-0000000000d2',
    '00000000-0000-0000-0000-0000000000d4'
  ]::uuid[],
  'p_accepting_only が true なら、受付停止中の占い師を返さない'
);

-- 16. 明示的に false なら受付停止中も含む
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

-- 17. タグの絞り込みと組み合わせる
select set_eq(
  $$ select teller_id from public.search_tellers(array['test-div-1'], true) where teller_id in (select id from test_tellers) $$,
  array['00000000-0000-0000-0000-0000000000d1']::uuid[],
  'タグと受付中のみを組み合わせると、両方を満たす占い師だけを返す'
);

-- 18. 並び順の指定なしなら新着順
select results_eq(
  $$ select teller_id from public.search_tellers() where teller_id in (select id from test_tellers) $$,
  array[
    '00000000-0000-0000-0000-0000000000d4',
    '00000000-0000-0000-0000-0000000000d3',
    '00000000-0000-0000-0000-0000000000d2',
    '00000000-0000-0000-0000-0000000000d1'
  ]::uuid[],
  '並び順を指定しなければ、占い師登録の新しい順に並ぶ'
);

-- 19. 新着順
select results_eq(
  $$ select teller_id from public.search_tellers('{}', false, 'newest') where teller_id in (select id from test_tellers) $$,
  array[
    '00000000-0000-0000-0000-0000000000d4',
    '00000000-0000-0000-0000-0000000000d3',
    '00000000-0000-0000-0000-0000000000d2',
    '00000000-0000-0000-0000-0000000000d1'
  ]::uuid[],
  'newest なら、占い師登録の新しい順に並ぶ'
);

-- 20. 評価順
select results_eq(
  $$ select teller_id from public.search_tellers('{}', false, 'rating') where teller_id in (select id from test_tellers) $$,
  array[
    '00000000-0000-0000-0000-0000000000d1',
    '00000000-0000-0000-0000-0000000000d4',
    '00000000-0000-0000-0000-0000000000d2',
    '00000000-0000-0000-0000-0000000000d3'
  ]::uuid[],
  'rating なら、レビュー数を加味した評価(ベイズ平均)の高い順に並ぶ(評価なしは最後)'
);

-- 21. セッション数順
select results_eq(
  $$ select teller_id from public.search_tellers('{}', false, 'sessions') where teller_id in (select id from test_tellers) $$,
  array[
    '00000000-0000-0000-0000-0000000000d2',
    '00000000-0000-0000-0000-0000000000d4',
    '00000000-0000-0000-0000-0000000000d1',
    '00000000-0000-0000-0000-0000000000d3'
  ]::uuid[],
  'sessions なら、完了セッション数の多い順に並ぶ(同数は新しい順)'
);

-- 22. 想定外の並び順はエラー
select throws_ok(
  $$ select * from public.search_tellers('{}', false, 'unknown') $$,
  '22P02',
  null,
  '想定外の並び順を指定するとエラーになる'
);

reset role;

-- ===== ログイン中の占い師(d1)=====
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000d1","role":"authenticated"}', true);

-- 23. 自分自身は返さない
select set_eq(
  $$ select teller_id from public.search_tellers() where teller_id in (select id from test_tellers) $$,
  array[
    '00000000-0000-0000-0000-0000000000d2',
    '00000000-0000-0000-0000-0000000000d3',
    '00000000-0000-0000-0000-0000000000d4'
  ]::uuid[],
  'ログイン中の占い師には、自分自身を返さない'
);

-- 24. ログイン中でもタグの絞り込みは効く
select set_eq(
  $$ select teller_id from public.search_tellers(array['test-div-1']) where teller_id in (select id from test_tellers) $$,
  array['00000000-0000-0000-0000-0000000000d3']::uuid[],
  'ログイン中でも、自分を除いたうえでタグで絞り込む'
);

reset role;

-- 25. 平均が高くてもレビューの少ない占い師は、平均がやや低くてもレビューの多い占い師より下に来る。
--     d4 を 5.0・1件、d2 を 4.8・20件にすると、d2: (12 + 96) ÷ 23 ≒ 4.70 / d4: (12 + 5) ÷ 4 = 4.25 / d1: 4.20
update public.teller_profiles as tp
   set average_rating = v.average_rating,
       review_count   = v.review_count
  from (values
    ('00000000-0000-0000-0000-0000000000d2'::uuid, 4.80, 20),
    ('00000000-0000-0000-0000-0000000000d4'::uuid, 5.00, 1)
  ) as v (profile_id, average_rating, review_count)
 where tp.profile_id = v.profile_id;

-- 23-24 で入れた d1 の JWT が残っていると d1 が「自分自身」として除かれるため、未ログインに戻す
select set_config('request.jwt.claims', '', true);
set local role anon;
select results_eq(
  $$ select teller_id from public.search_tellers('{}', false, 'rating') where teller_id in (select id from test_tellers) $$,
  array[
    '00000000-0000-0000-0000-0000000000d2',
    '00000000-0000-0000-0000-0000000000d4',
    '00000000-0000-0000-0000-0000000000d1',
    '00000000-0000-0000-0000-0000000000d3'
  ]::uuid[],
  'rating なら、平均 5.0・1件の占い師は、平均 4.8・20件の占い師より下に来る'
);
reset role;

-- 26. 退会したユーザーは出さない
update public.profiles set deleted_at = now() where id = '00000000-0000-0000-0000-0000000000d1';

set local role anon;
select set_eq(
  $$ select teller_id from public.search_tellers() where teller_id in (select id from test_tellers) $$,
  array[
    '00000000-0000-0000-0000-0000000000d2',
    '00000000-0000-0000-0000-0000000000d3',
    '00000000-0000-0000-0000-0000000000d4'
  ]::uuid[],
  '退会したユーザーは検索結果に出ない'
);
reset role;

select * from finish();
rollback;
