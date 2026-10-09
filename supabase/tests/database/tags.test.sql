begin;
select plan(9);

-- 1. RLS が有効
select ok(
  (select relrowsecurity from pg_class where oid = 'public.tags'::regclass),
  'tags: RLS が有効'
);

-- テストデータ(postgres 権限で投入)
insert into public.tags (id, name) values
  ('00000000-0000-0000-0000-0000000000a1', 'タロット');

-- 2. anon は select できる
set local role anon;
select is(
  (select count(*)::int from public.tags where name = 'タロット'),
  1,
  'anon は tags を select できる'
);

-- 3. anon は insert できない
select throws_ok(
  $$ insert into public.tags (name) values ('四柱推命') $$,
  '42501',
  null,
  'anon は tags を insert できない'
);
reset role;

-- 4. authenticated は select できる
set local role authenticated;
select is(
  (select count(*)::int from public.tags where name = 'タロット'),
  1,
  'authenticated は tags を select できる'
);

-- 5. authenticated は insert できない
select throws_ok(
  $$ insert into public.tags (name) values ('四柱推命') $$,
  '42501',
  null,
  'authenticated は tags を insert できない'
);

-- 6. authenticated は update できない
select throws_ok(
  $$ update public.tags set name = '変更' where name = 'タロット' $$,
  '42501',
  null,
  'authenticated は tags を update できない'
);

-- 7. authenticated は delete できない
select throws_ok(
  $$ delete from public.tags where name = 'タロット' $$,
  '42501',
  null,
  'authenticated は tags を delete できない'
);
reset role;

-- 8. name は UNIQUE
select throws_ok(
  $$ insert into public.tags (name) values ('タロット') $$,
  '23505',
  null,
  'tags.name は重複できない'
);

-- 9. name は NOT NULL
select throws_ok(
  $$ insert into public.tags (name) values (null) $$,
  '23502',
  null,
  'tags.name は NULL にできない'
);

select * from finish();
rollback;