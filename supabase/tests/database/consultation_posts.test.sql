begin;
select plan(20);

-- ===== テストデータ(postgres 権限) =====
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000c1', 'alice@example.com'),
  ('00000000-0000-0000-0000-0000000000c2', 'bob@example.com');

insert into public.consultation_posts (id, consultant_id, concern, status) values
  ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000c1', 'aliceの悩み1', 'open'),
  ('00000000-0000-0000-0000-0000000000d2', '00000000-0000-0000-0000-0000000000c1', 'aliceの悩み2', 'closed'),
  ('00000000-0000-0000-0000-0000000000d3', '00000000-0000-0000-0000-0000000000c2', 'bobの悩み',    'open');

-- 1. RLS が有効
select ok(
  (select relrowsecurity from pg_class where oid = 'public.consultation_posts'::regclass),
  'consultation_posts: RLS が有効'
);

-- 2. updated_at 用トリガーが付いている(トリガー名は既存の命名に合わせて調整)
select has_trigger('public', 'consultation_posts', 'set_updated_at',
  'consultation_posts: updated_at トリガーがある');

-- ===== anon =====
set local role anon;

-- 3. anon は closed 以外だけ見える(d1, d3 の2件。d2 は closed)
select is(
  (select count(*)::int from public.consultation_posts
    where id in ('00000000-0000-0000-0000-0000000000d1',
                 '00000000-0000-0000-0000-0000000000d2',
                 '00000000-0000-0000-0000-0000000000d3')),
  2,
  'anon は closed 以外の投稿だけ select できる'
);

-- 4. anon は insert できない
select throws_ok(
  $$ insert into public.consultation_posts (consultant_id, concern)
     values ('00000000-0000-0000-0000-0000000000c1', 'x') $$,
  '42501', null,
  'anon は insert できない'
);

-- 5. anon は update できない
select throws_ok(
  $$ update public.consultation_posts set concern = 'x' $$,
  '42501', null,
  'anon は update できない'
);
reset role;

-- ===== authenticated(alice) =====
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}', true);

-- 6. alice は自分の投稿(closed 含む)+ 他人の open 投稿が見える(d1, d2, d3 の3件)
select is(
  (select count(*)::int from public.consultation_posts
    where id in ('00000000-0000-0000-0000-0000000000d1',
                 '00000000-0000-0000-0000-0000000000d2',
                 '00000000-0000-0000-0000-0000000000d3')),
  3,
  'alice は自分の closed 投稿と他人の open 投稿を select できる'
);

-- 7. alice は自分名義で insert できる
select lives_ok(
  $$ insert into public.consultation_posts (consultant_id, category, concern)
     values ('00000000-0000-0000-0000-0000000000c1', null, '新しい悩み') $$,
  'alice は自分名義の投稿を insert できる'
);

-- 8. alice は他人名義では insert できない
select throws_ok(
  $$ insert into public.consultation_posts (consultant_id, concern)
     values ('00000000-0000-0000-0000-0000000000c2', 'なりすまし') $$,
  '42501', null,
  'alice は他人名義の投稿を insert できない'
);

-- 9. alice は insert 時に status を指定できない(列 GRANT)
select throws_ok(
  $$ insert into public.consultation_posts (consultant_id, concern, status)
     values ('00000000-0000-0000-0000-0000000000c1', 'x', 'closed') $$,
  '42501', null,
  'alice は insert 時に status を指定できない'
);

-- 10. alice は自分の投稿の concern を更新できる
select lives_ok(
  $$ update public.consultation_posts set concern = '更新した悩み'
     where id = '00000000-0000-0000-0000-0000000000d1' $$,
  'alice は自分の投稿の concern を update できる'
);

-- 11. alice は status を in_progress にできない(with check)
select throws_ok(
  $$ update public.consultation_posts set status = 'in_progress'
     where id = '00000000-0000-0000-0000-0000000000d1' $$,
  '42501', null,
  'alice は status を in_progress にできない'
);

-- 12. alice は consultant_id を変更できない(列 GRANT)
select throws_ok(
  $$ update public.consultation_posts
     set consultant_id = '00000000-0000-0000-0000-0000000000c2'
     where id = '00000000-0000-0000-0000-0000000000d1' $$,
  '42501', null,
  'alice は consultant_id を update できない'
);

-- 13. alice は自分の投稿を closed にできる
select lives_ok(
  $$ update public.consultation_posts set status = 'closed'
     where id = '00000000-0000-0000-0000-0000000000d1' $$,
  'alice は自分の投稿を closed にできる'
);

-- alice が bob の投稿を update / delete しても 0 行(エラーにならない)
update public.consultation_posts set concern = '書き換え'
  where id = '00000000-0000-0000-0000-0000000000d3';
delete from public.consultation_posts
  where id = '00000000-0000-0000-0000-0000000000d3';
reset role;

-- 14. bob の投稿は変わらず残っている
select is(
  (select count(*)::int from public.consultation_posts
    where id = '00000000-0000-0000-0000-0000000000d3' and concern = 'bobの悩み'),
  1,
  'alice は他人の投稿を update / delete できない'
);

-- ===== authenticated(bob) =====
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000c2","role":"authenticated"}', true);

-- 15. bob には alice の closed 投稿(d1, d2)は見えず、自分の d3 だけ見える
select is(
  (select count(*)::int from public.consultation_posts
    where id in ('00000000-0000-0000-0000-0000000000d1',
                 '00000000-0000-0000-0000-0000000000d2',
                 '00000000-0000-0000-0000-0000000000d3')),
  1,
  'bob には他人の closed 投稿が見えない'
);
reset role;

-- ===== alice が自分の投稿を delete =====
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}', true);
delete from public.consultation_posts
  where id = '00000000-0000-0000-0000-0000000000d2';
reset role;

-- 16. 自分の投稿は削除できる
select is(
  (select count(*)::int from public.consultation_posts
    where id = '00000000-0000-0000-0000-0000000000d2'),
  0,
  'alice は自分の投稿を delete できる'
);

-- ===== 制約(postgres 権限) =====
-- 17. status に想定外の値は入らない
select throws_ok(
  $$ insert into public.consultation_posts (consultant_id, concern, status)
     values ('00000000-0000-0000-0000-0000000000c1', 'x', 'resolved') $$,
  '23514', null,
  'status は open / in_progress / closed 以外を入れられない'
);

-- 18. concern は NOT NULL
select throws_ok(
  $$ insert into public.consultation_posts (consultant_id, concern)
     values ('00000000-0000-0000-0000-0000000000c1', null) $$,
  '23502', null,
  'concern は NULL にできない'
);

-- 19. 存在しない consultant_id は外部キー違反
select throws_ok(
  $$ insert into public.consultation_posts (consultant_id, concern)
     values (gen_random_uuid(), 'x') $$,
  '23503', null,
  '存在しない consultant_id は外部キー違反'
);

-- 20. closed は有効な status として入る
select lives_ok(
  $$ insert into public.consultation_posts (consultant_id, concern, status)
     values ('00000000-0000-0000-0000-0000000000c1', 'x', 'closed') $$,
  'status = closed を設定できる'
);

select * from finish();
rollback;