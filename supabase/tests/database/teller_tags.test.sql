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

insert into public.tags (id, category, slug, name) values
  ('00000000-0000-0000-0000-0000000000a1', 'divination', 'test-divination-1', 'テスト占術1'),
  ('00000000-0000-0000-0000-0000000000a2', 'divination', 'test-divination-2', 'テスト占術2'),
  ('00000000-0000-0000-0000-0000000000a3', 'divination', 'test-divination-3', 'テスト占術3');

-- bob は「テスト占術1」を持っている
insert into public.teller_tags (teller_id, tag_id) values
  ('00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-0000000000a1');

-- 1. RLS が有効
select ok(
  (select relrowsecurity from pg_class where oid = 'public.teller_tags'::regclass),
  'teller_tags: RLS が有効'
);

-- ===== anon =====
set local role anon;

-- 2. anon は select できる(seed などテスト外の行に左右されないよう、テストの占い師の行だけを数える)
select is(
  (select count(*)::int from public.teller_tags
    where teller_id in ('00000000-0000-0000-0000-0000000000b1',
                        '00000000-0000-0000-0000-0000000000b2')),
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
  (select count(*)::int from public.teller_tags
    where teller_id = '00000000-0000-0000-0000-0000000000b2'),
  1,
  'authenticated は他人の teller_tags も select できる'
);

-- 5. alice は自分のタグも直接 insert できない(タグの書き換えは save_teller_profile だけで行い、
--    占術タグの無い占い師を作らせないため)
select throws_ok(
  $$ insert into public.teller_tags (teller_id, tag_id) values
     ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000a2') $$,
  '42501', null,
  'alice は自分の teller_tags も直接 insert できない'
);

-- 6. alice は他人(bob)名義では insert できない
--    (insert の権限自体が無いため、RLS より前に権限不足で弾かれる。5 と同じ理由)
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

-- 8. alice は他人(bob)の行を delete できない
select throws_ok(
  $$ delete from public.teller_tags
       where teller_id = '00000000-0000-0000-0000-0000000000b2' $$,
  '42501', null,
  'alice は他人の teller_tags を delete できない'
);

-- 9. alice は自分の行も直接 delete できない(5 と同じ理由)
select throws_ok(
  $$ delete from public.teller_tags
       where teller_id = '00000000-0000-0000-0000-0000000000b1' $$,
  '42501', null,
  'alice は自分の teller_tags も直接 delete できない'
);
reset role;

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