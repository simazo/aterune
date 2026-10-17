begin;
select plan(16);

-- 1. RLS が有効
select ok(
  (select relrowsecurity from pg_class where oid = 'public.tags'::regclass),
  'tags: RLS が有効'
);

-- テストデータ(postgres 権限で投入)。seed のタグと重ならないよう、テスト専用の slug・名前にする
insert into public.tags (id, category, slug, name) values
  ('00000000-0000-0000-0000-0000000000a1', 'divination', 'test-divination-1', 'テスト占術1');

-- 2. anon は select できる
set local role anon;
select is(
  (select count(*)::int from public.tags where name = 'テスト占術1'),
  1,
  'anon は tags を select できる'
);

-- 3. anon は insert できない
select throws_ok(
  $$ insert into public.tags (category, slug, name) values ('divination', 'test-divination-2', 'テスト占術2') $$,
  '42501',
  null,
  'anon は tags を insert できない'
);
reset role;

-- 4. authenticated は select できる
set local role authenticated;
select is(
  (select count(*)::int from public.tags where name = 'テスト占術1'),
  1,
  'authenticated は tags を select できる'
);

-- 5. authenticated は insert できない
select throws_ok(
  $$ insert into public.tags (category, slug, name) values ('divination', 'test-divination-2', 'テスト占術2') $$,
  '42501',
  null,
  'authenticated は tags を insert できない'
);

-- 6. authenticated は update できない
select throws_ok(
  $$ update public.tags set name = '変更' where name = 'テスト占術1' $$,
  '42501',
  null,
  'authenticated は tags を update できない'
);

-- 7. authenticated は delete できない
select throws_ok(
  $$ delete from public.tags where name = 'テスト占術1' $$,
  '42501',
  null,
  'authenticated は tags を delete できない'
);
reset role;

-- 8. 同じ category の中で name は重複できない
select throws_ok(
  $$ insert into public.tags (category, slug, name) values ('divination', 'test-divination-dup', 'テスト占術1') $$,
  '23505',
  null,
  '同じ category の中で tags.name は重複できない'
);

-- 9. category が違えば同じ name を使える
select lives_ok(
  $$ insert into public.tags (category, slug, name) values ('style', 'test-style-dup', 'テスト占術1') $$,
  'category が違えば tags.name は重複できる'
);

-- 10. slug は category をまたいでも重複できない
select throws_ok(
  $$ insert into public.tags (category, slug, name) values ('style', 'test-divination-1', 'テストスタイル1') $$,
  '23505',
  null,
  'tags.slug は category が違っても重複できない'
);

-- 11. slug は英小文字・数字・ハイフンのみ
select throws_ok(
  $$ insert into public.tags (category, slug, name) values ('style', 'Test Style', 'テストスタイル1') $$,
  '23514',
  null,
  'tags.slug に大文字や空白は使えない'
);

-- 12. category は決められた値のみ
select throws_ok(
  $$ insert into public.tags (category, slug, name) values ('unknown', 'test-style-1', 'テストスタイル1') $$,
  '23514',
  null,
  'tags.category は divination / style / concern 以外にできない'
);

-- 13. concern(悩み・相談)の種類で登録できる
select lives_ok(
  $$ insert into public.tags (category, slug, name) values ('concern', 'test-concern-1', 'テスト悩み1') $$,
  'tags.category に concern を使える'
);

-- 14. name は NOT NULL
select throws_ok(
  $$ insert into public.tags (category, slug, name) values ('style', 'test-style-1', null) $$,
  '23502',
  null,
  'tags.name は NULL にできない'
);

-- 15. slug は NOT NULL
select throws_ok(
  $$ insert into public.tags (category, slug, name) values ('style', null, 'テストスタイル1') $$,
  '23502',
  null,
  'tags.slug は NULL にできない'
);

-- 16. category は NOT NULL
select throws_ok(
  $$ insert into public.tags (category, slug, name) values (null, 'test-style-1', 'テストスタイル1') $$,
  '23502',
  null,
  'tags.category は NULL にできない'
);

select * from finish();
rollback;
