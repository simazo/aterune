begin;
select plan(20);

-- ===== テストデータ(postgres 権限) =====
-- alice・bob・carol はどれも一般ユーザー(ブロックは相談者・占い師のどちらも使えるため、役割は関係ない)
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000b1', 'alice@example.com'),
  ('00000000-0000-0000-0000-0000000000b2', 'bob@example.com'),
  ('00000000-0000-0000-0000-0000000000b3', 'carol@example.com');

-- bob は carol をブロックしている
insert into public.blocks (blocker_id, blocked_id) values
  ('00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-0000000000b3');

-- 1. RLS が有効
select ok(
  (select relrowsecurity from pg_class where oid = 'public.blocks'::regclass),
  'blocks: RLS が有効'
);

-- 2-3. has_block_with は anon・authenticated から呼べる(未ログインでも呼ばれる search_tellers・get_teller から使うため)
select ok(has_function_privilege('anon', 'public.has_block_with(uuid)', 'execute'),
  'anon は has_block_with を実行できる');
select ok(has_function_privilege('authenticated', 'public.has_block_with(uuid)', 'execute'),
  'authenticated は has_block_with を実行できる');

-- ===== anon =====
set local role anon;

-- 4. anon は select できない
select throws_ok(
  $$ select * from public.blocks $$,
  '42501', null,
  'anon は blocks を select できない'
);

-- 5. 未ログインなら、誰とのブロックも無い扱い
select is(public.has_block_with('00000000-0000-0000-0000-0000000000b3'), false,
  '未ログインなら has_block_with は false');
reset role;

-- ===== authenticated(alice) =====
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}', true);

-- 6. 他人のブロックは見えない
select is(
  (select count(*)::int from public.blocks),
  0,
  'alice には他人の blocks が見えない'
);

-- 7. 他人同士のブロックは、has_block_with でも分からない(自分と相手の間しか見ない)
select is(public.has_block_with('00000000-0000-0000-0000-0000000000b3'), false,
  '他人同士のブロックは has_block_with に出ない');

-- 8. 自分名義でブロックできる
select lives_ok(
  $$ insert into public.blocks (blocker_id, blocked_id) values
     ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000b2') $$,
  'alice は自分の blocks を insert できる'
);

-- 9. 自分のブロックは読める
select results_eq(
  $$ select blocker_id, blocked_id from public.blocks $$,
  $$ values ('00000000-0000-0000-0000-0000000000b1'::uuid, '00000000-0000-0000-0000-0000000000b2'::uuid) $$,
  'alice は自分の blocks を読める'
);

-- 10. 他人名義ではブロックできない
select throws_ok(
  $$ insert into public.blocks (blocker_id, blocked_id) values
     ('00000000-0000-0000-0000-0000000000b3', '00000000-0000-0000-0000-0000000000b1') $$,
  '42501', null,
  'alice は他人名義の blocks を insert できない'
);

-- 11. 同じ相手を二重にブロックできない
select throws_ok(
  $$ insert into public.blocks (blocker_id, blocked_id) values
     ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000b2') $$,
  '23505', null,
  '同じ相手を二重にブロックできない'
);

-- 12. 自分自身はブロックできない
select throws_ok(
  $$ insert into public.blocks (blocker_id, blocked_id) values
     ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000b1') $$,
  '23514', null,
  '自分自身はブロックできない'
);

-- 13. update はできない
select throws_ok(
  $$ update public.blocks set blocked_id = blocked_id $$,
  '42501', null,
  'authenticated は blocks を update できない'
);

-- 14. ブロックした側から見て、ブロックがある
select is(public.has_block_with('00000000-0000-0000-0000-0000000000b2'), true,
  'ブロックした側から見て has_block_with は true');

-- ===== authenticated(bob。alice にブロックされている) =====
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000b2","role":"authenticated"}', true);

-- 15. ブロックされた側は、ブロックの行を読めない
select is(
  (select count(*)::int from public.blocks
    where blocker_id = '00000000-0000-0000-0000-0000000000b1'),
  0,
  'ブロックされた側は、相手のブロックの行を読めない'
);

-- 16. ブロックされた側から見ても、ブロックがある(どちらの向きでも効くため)
select is(public.has_block_with('00000000-0000-0000-0000-0000000000b1'), true,
  'ブロックされた側から見ても has_block_with は true');

-- 17. 他人のブロックは消せない(0 行の削除になる)
delete from public.blocks where blocker_id = '00000000-0000-0000-0000-0000000000b1';

-- ===== authenticated(alice) =====
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}', true);

select is(
  (select count(*)::int from public.blocks),
  1,
  '他人のブロックは delete できない'
);

-- 18. 自分のブロックは解除できる
delete from public.blocks where blocked_id = '00000000-0000-0000-0000-0000000000b2';
select is(
  (select count(*)::int from public.blocks),
  0,
  'alice は自分の blocks を delete できる'
);

-- 19. 解除すると、ブロックは無くなる
select is(public.has_block_with('00000000-0000-0000-0000-0000000000b2'), false,
  '解除すると has_block_with は false');
reset role;

-- 20. ユーザーが退会する(auth.users の削除)と、そのユーザーのブロックも連鎖削除される
delete from auth.users where id = '00000000-0000-0000-0000-0000000000b3';
select is(
  (select count(*)::int from public.blocks
    where blocked_id = '00000000-0000-0000-0000-0000000000b3'),
  0,
  'ブロックされたユーザーが削除されると、blocks も連鎖削除される'
);

select * from finish();
rollback;
