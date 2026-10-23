begin;
select plan(6);

-- ===== テストデータ(postgres 権限)=====
-- alice=タグを持つ占い師 / bob=タグの無い占い師
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000b1', 'alice@example.com'),
  ('00000000-0000-0000-0000-0000000000b2', 'bob@example.com');

insert into public.teller_profiles (profile_id) values
  ('00000000-0000-0000-0000-0000000000b1'),
  ('00000000-0000-0000-0000-0000000000b2');

-- 種類・表示順・名前の並びを確かめるため、入れる順番はわざとばらばらにする。
-- テスト占術A と テスト占術B は種類も表示順も同じなので、名前順で並ぶ
insert into public.tags (id, category, slug, name, sort_order) values
  ('00000000-0000-0000-0000-0000000000a1', 'style',      'test-style-1',      'テストスタイル1', 1),
  ('00000000-0000-0000-0000-0000000000a2', 'concern',    'test-concern-1',    'テスト悩み1',     1),
  ('00000000-0000-0000-0000-0000000000a3', 'divination', 'test-divination-b', 'テスト占術B',     1),
  ('00000000-0000-0000-0000-0000000000a4', 'divination', 'test-divination-c', 'テスト占術C',     2),
  ('00000000-0000-0000-0000-0000000000a5', 'divination', 'test-divination-a', 'テスト占術A',     1);

insert into public.teller_tags (teller_id, tag_id) values
  ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000a1'),
  ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000a2'),
  ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000a3'),
  ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000a4'),
  ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000a5');

-- 1-3. 実行権限と security invoker
select ok(
  has_function_privilege('anon', 'public.list_teller_tags_json(uuid)', 'execute'),
  'anon は list_teller_tags_json を実行できる(search_tellers・get_teller から呼ぶため)'
);
select ok(
  has_function_privilege('authenticated', 'public.list_teller_tags_json(uuid)', 'execute'),
  'authenticated は list_teller_tags_json を実行できる'
);
select ok(
  not (select prosecdef from pg_proc
        where oid = 'public.list_teller_tags_json(uuid)'::regprocedure),
  'list_teller_tags_json は security invoker(参照先は誰でも読める)'
);

-- 4. 種類(占術 → 悩み → 回答のスタイル)→ 表示順 → 名前の順に並ぶ
set local role anon;
select is(
  public.list_teller_tags_json('00000000-0000-0000-0000-0000000000b1'),
  '[
     {"slug": "test-divination-a", "category": "divination", "name": "テスト占術A"},
     {"slug": "test-divination-b", "category": "divination", "name": "テスト占術B"},
     {"slug": "test-divination-c", "category": "divination", "name": "テスト占術C"},
     {"slug": "test-concern-1",    "category": "concern",    "name": "テスト悩み1"},
     {"slug": "test-style-1",      "category": "style",      "name": "テストスタイル1"}
   ]'::jsonb,
  'タグは種類 → 表示順 → 名前の順に、slug・category・name の形で並ぶ'
);

-- 5. タグの無い占い師は空配列
select is(
  public.list_teller_tags_json('00000000-0000-0000-0000-0000000000b2'),
  '[]'::jsonb,
  'タグの無い占い師なら空配列を返す'
);

-- 6. 存在しない ID でも空配列(null にしない)
select is(
  public.list_teller_tags_json(gen_random_uuid()),
  '[]'::jsonb,
  '存在しない ID なら空配列を返す'
);
reset role;

select * from finish();
rollback;
