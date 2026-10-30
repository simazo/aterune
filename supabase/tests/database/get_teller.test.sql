begin;
select plan(13);

-- ===== テストデータ(postgres 権限)=====
-- seed に依存しないよう、タグ・占い師はすべてここで作る
-- e1: 全種類のタグあり・受付中 / e2: タグなし・受付停止中・生年月日必須 / e3: 占い師ではない
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000e1', 'e1@example.com', '{"display_name":"テスト占い師1"}'),
  ('00000000-0000-0000-0000-0000000000e2', 'e2@example.com', '{"display_name":"テスト占い師2"}'),
  ('00000000-0000-0000-0000-0000000000e3', 'e3@example.com', '{"display_name":"一般ユーザー"}');

insert into public.teller_profiles (profile_id, self_pr, training_period, is_accepting, requires_birthdate) values
  ('00000000-0000-0000-0000-0000000000e1', 'e1 の自己PR', '半年', true,  false),
  ('00000000-0000-0000-0000-0000000000e2', null,          null,   false, true);

-- キャッシュ値と登録日時は postgres 権限で直接入れる(結果の列の確認用)
update public.teller_profiles
   set average_rating = 4.50,
       review_count   = 2,
       session_count  = 3,
       favorite_count = 5,
       created_at     = '2026-10-01 12:00:00+09'
 where profile_id = '00000000-0000-0000-0000-0000000000e1';

-- アイコンは e1 だけに入れる(列の確認用)
update public.profiles
   set avatar_path = '00000000-0000-0000-0000-0000000000e1/1730000000000.jpg'
 where id = '00000000-0000-0000-0000-0000000000e1';

-- 占術2 の表示順を占術1 より前にして、tags の並び順を確かめられるようにする
insert into public.tags (id, category, slug, name, sort_order) values
  ('00000000-0000-0000-0000-000000000e01', 'divination', 'test-div-1',     'テスト占術1',     2),
  ('00000000-0000-0000-0000-000000000e02', 'divination', 'test-div-2',     'テスト占術2',     1),
  ('00000000-0000-0000-0000-000000000e03', 'style',      'test-style-1',   'テストスタイル1', 1),
  ('00000000-0000-0000-0000-000000000e04', 'concern',    'test-concern-1', 'テスト悩み1',     1);

insert into public.teller_tags (teller_id, tag_id) values
  ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-000000000e01'),
  ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-000000000e02'),
  ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-000000000e03'),
  ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-000000000e04');

-- 1-2. 実行権限
select ok(
  has_function_privilege('anon', 'public.get_teller(uuid)', 'execute'),
  'anon は get_teller を実行できる'
);
select ok(
  has_function_privilege('authenticated', 'public.get_teller(uuid)', 'execute'),
  'authenticated は get_teller を実行できる'
);

-- ===== 未ログイン(anon)=====
set local role anon;

-- 3. 詳細画面用の列
select results_eq(
  $$ select teller_id, display_name, avatar_path, self_pr, training_period, is_accepting, requires_birthdate,
            average_rating, review_count, session_count, favorite_count, created_at
       from public.get_teller('00000000-0000-0000-0000-0000000000e1') $$,
  $$ values ('00000000-0000-0000-0000-0000000000e1'::uuid, 'テスト占い師1'::text,
             '00000000-0000-0000-0000-0000000000e1/1730000000000.jpg'::text, 'e1 の自己PR'::text,
             '半年'::text, true, false, 4.50::numeric, 2, 3, 5, '2026-10-01 12:00:00+09'::timestamptz) $$,
  '指定した占い師の表示名・アイコンのパス・自己PR・修行期間・受付状態・生年月日の要否・評価・件数・セッション数・お気に入りの人数・登録日時を返す'
);

-- 4. tags は種類 → 表示順の順
select is(
  (select tags from public.get_teller('00000000-0000-0000-0000-0000000000e1')),
  '[{"slug": "test-div-2",     "category": "divination", "name": "テスト占術2"},
    {"slug": "test-div-1",     "category": "divination", "name": "テスト占術1"},
    {"slug": "test-concern-1", "category": "concern",    "name": "テスト悩み1"},
    {"slug": "test-style-1",   "category": "style",      "name": "テストスタイル1"}]'::jsonb,
  'tags は種類(占術 → 悩み → スタイル)→ 表示順(sort_order)の順に並ぶ'
);

-- 5. 受付停止中・生年月日必須・未入力の項目
select results_eq(
  $$ select self_pr, training_period, is_accepting, requires_birthdate, average_rating, review_count, session_count,
            favorite_count
       from public.get_teller('00000000-0000-0000-0000-0000000000e2') $$,
  $$ values (null::text, null::text, false, true, null::numeric, 0, 0, 0) $$,
  '受付停止中・生年月日必須の占い師も返し、未入力の項目と評価なしは null'
);

-- 6. タグの無い占い師は空配列
select is(
  (select tags from public.get_teller('00000000-0000-0000-0000-0000000000e2')),
  '[]'::jsonb,
  'タグの無い占い師の tags は空配列'
);

-- 7. 占い師登録の無いユーザー
select is_empty(
  $$ select * from public.get_teller('00000000-0000-0000-0000-0000000000e3') $$,
  '占い師登録の無いユーザーの ID なら 0 行'
);

-- 8. 存在しない ID
select is_empty(
  $$ select * from public.get_teller('00000000-0000-0000-0000-0000000000ff') $$,
  '存在しない ID なら 0 行'
);

reset role;

-- ===== ログイン中の占い師(e1)=====
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000e1","role":"authenticated"}', true);

-- 9. 検索と違い、自分自身も返す
select is(
  (select teller_id from public.get_teller('00000000-0000-0000-0000-0000000000e1')),
  '00000000-0000-0000-0000-0000000000e1'::uuid,
  'ログイン中の占い師が自分の ID を指定すると、自分を返す'
);

reset role;

-- 10. 退会したユーザーは返さない
update public.profiles set deleted_at = now() where id = '00000000-0000-0000-0000-0000000000e1';

set local role anon;
select is_empty(
  $$ select * from public.get_teller('00000000-0000-0000-0000-0000000000e1') $$,
  '退会したユーザーの ID なら 0 行'
);
reset role;

-- ===== ブロック(e3=一般ユーザーがログイン中、e2=占い師)=====
-- 11. ブロックした占い師は返さない
insert into public.blocks (blocker_id, blocked_id) values
  ('00000000-0000-0000-0000-0000000000e3', '00000000-0000-0000-0000-0000000000e2');

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000e3","role":"authenticated"}', true);
select is_empty(
  $$ select * from public.get_teller('00000000-0000-0000-0000-0000000000e2') $$,
  'ブロックした占い師の ID なら 0 行'
);
reset role;

-- 12. 自分をブロックした占い師も返さない(逆の向き)
delete from public.blocks where blocker_id = '00000000-0000-0000-0000-0000000000e3';
insert into public.blocks (blocker_id, blocked_id) values
  ('00000000-0000-0000-0000-0000000000e2', '00000000-0000-0000-0000-0000000000e3');

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000e3","role":"authenticated"}', true);
select is_empty(
  $$ select * from public.get_teller('00000000-0000-0000-0000-0000000000e2') $$,
  '自分をブロックした占い師の ID なら 0 行'
);
reset role;

-- 13. 解除すると、元どおり返す
delete from public.blocks where blocker_id = '00000000-0000-0000-0000-0000000000e2';

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000e3","role":"authenticated"}', true);
select is(
  (select teller_id from public.get_teller('00000000-0000-0000-0000-0000000000e2')),
  '00000000-0000-0000-0000-0000000000e2'::uuid,
  'ブロックを解除すると、占い師を返す'
);
reset role;
select set_config('request.jwt.claims', '', true);

select * from finish();
rollback;
