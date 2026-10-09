begin;
select plan(12);

-- ===== テストデータ(postgres 権限) =====
-- auth.users に入れると handle_new_user トリガーで profiles が作られる
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000b1', 'alice@example.com'),
  ('00000000-0000-0000-0000-0000000000b2', 'bob@example.com');

insert into public.teller_profiles (profile_id) values
  ('00000000-0000-0000-0000-0000000000b1'),
  ('00000000-0000-0000-0000-0000000000b2');

insert into public.tags (id, name) values
  ('00000000-0000-0000-0000-0000000000a1', 'タロット'),
  ('00000000-0000-0000-0000-0000000000a2', '四柱推命'),
  ('00000000-0000-0000-0000-0000000000a3', '手相');

-- bob は「タロット」を持っている
insert into public.teller_tags (teller_id, tag_id) values
  ('00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-0000000000a1');

-- 1. RLS が有効
select ok(
  (select relrowsecurity from pg_class where oid = 'public.teller_tags'::regclass),
  'teller_tags: RLS が有効'
);

-- ===== anon =====
set local role anon;

-- 2. anon は select できる
select is(
  (select count(*)::int from public.teller_tags),
  1,
  'anon は teller_tags を select できる'
);

-- 3. anon は insert できない
select throws_ok(
  $$ insert into public.teller_tags (teller_id, tag_id) values
     ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000a1') $$,
  '42501', null,
  'anon は teller_tags を insert できない'
);
reset role;

-- ===== authenticated(alice) =====
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}', true);

-- 4. alice は他人の行も select できる
select is(
  (select count(*)::int from public.teller_tags),
  1,
  'authenticated は他人の teller_tags も select できる'
);

-- 5. alice は自分のタグを insert できる
select lives_ok(
  $$ insert into public.teller_tags (teller_id, tag_id) values
     ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000a2') $$,
  'alice は自分の teller_tags を insert できる'
);

-- 6. alice は他人(bob)名義では insert できない
select throws_ok(
  $$ insert into public.teller_tags (teller_id, tag_id) values
     ('00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-0000000000a3') $$,
  '42501', null,
  'alice は他人名義の teller_tags を insert できない'
);

-- 7. alice は update できない
select throws_ok(
  $$ update public.teller_tags set tag_id = '00000000-0000-0000-0000-0000000000a3'
     where teller_id = '00000000-0000-0000-0000-0000000000b1' $$,
  '42501', null,
  'authenticated は teller_tags を update できない'
);

-- 8. alice は他人(bob)の行を delete しても 0 行(RLS で見えない対象)
delete from public.teller_tags
  where teller_id = '00000000-0000-0000-0000-0000000000b2';
reset role;
select is(
  (select count(*)::int from public.teller_tags
    where teller_id = '00000000-0000-0000-0000-0000000000b2'),
  1,
  'alice は他人の teller_tags を delete できない(行が残る)'
);

-- 9. alice は自分の行を delete できる
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}', true);
delete from public.teller_tags
  where teller_id = '00000000-0000-0000-0000-0000000000b1';
reset role;
select is(
  (select count(*)::int from public.teller_tags
    where teller_id = '00000000-0000-0000-0000-0000000000b1'),
  0,
  'alice は自分の teller_tags を delete できる'
);

-- ===== 制約(postgres 権限) =====
-- 10. 同じ組み合わせは重複できない(主キー)
select throws_ok(
  $$ insert into public.teller_tags (teller_id, tag_id) values
     ('00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-0000000000a1') $$,
  '23505', null,
  '同じ teller_id と tag_id の組は重複できない'
);

-- 11. 占い師でない teller_id は外部キーで弾かれる
select throws_ok(
  $$ insert into public.teller_tags (teller_id, tag_id) values
     (gen_random_uuid(), '00000000-0000-0000-0000-0000000000a1') $$,
  '23503', null,
  '存在しない teller_id は外部キー違反'
);

-- 12. tag を消すと teller_tags も連鎖削除される
delete from public.tags where id = '00000000-0000-0000-0000-0000000000a1';
select is(
  (select count(*)::int from public.teller_tags
    where tag_id = '00000000-0000-0000-0000-0000000000a1'),
  0,
  'tags を削除すると teller_tags も連鎖削除される(ON DELETE CASCADE)'
);

select * from finish();
rollback;