begin;
select plan(23);

-- ===== テストデータ(postgres 権限) =====
-- alice=投稿者(相談者)/ bob=占い師で投稿者でもある
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000c1', 'alice@example.com'),
  ('00000000-0000-0000-0000-0000000000c2', 'bob@example.com');

insert into public.teller_profiles (profile_id) values
  ('00000000-0000-0000-0000-0000000000c2');

-- seed に依存しないよう、テスト用の悩みタグを作る
insert into public.tags (id, category, slug, name) values
  ('00000000-0000-0000-0000-0000000000e1', 'concern', 'test-concern-a', 'テスト悩みA');

-- p1=alice の open(3時間前)/ p2=alice の closed / p3=bob の open(1時間前)/ p4=alice の in_progress(2時間前)
insert into public.consultation_posts (id, consultant_id, concern_tag_id, concern, status, created_at) values
  ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000e1', 'p1', 'open',        now() - interval '3 hours'),
  ('00000000-0000-0000-0000-0000000000d2', '00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000e1', 'p2', 'closed',      now() - interval '4 hours'),
  ('00000000-0000-0000-0000-0000000000d3', '00000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-0000000000e1', 'p3', 'open',        now() - interval '1 hour'),
  ('00000000-0000-0000-0000-0000000000d4', '00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000e1', 'p4', 'in_progress', now() - interval '2 hours');

-- bob が p1 に応募済み
insert into public.sessions (applicant_id, recipient_id, consultant_id, teller_id, initiated_by, post_id) values
  ('00000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-0000000000c1',
   '00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000c2', 'teller',
   '00000000-0000-0000-0000-0000000000d1');

-- 1-2. 投稿者を匿名にするため、一覧・詳細の関数は consultant_id を返さない
select ok(
  (select not ('consultant_id' = any (proargnames)) from pg_proc
    where oid = 'public.list_consultation_posts()'::regprocedure),
  'list_consultation_posts は consultant_id を返さない'
);
select ok(
  (select not ('consultant_id' = any (proargnames)) from pg_proc
    where oid = 'public.get_consultation_post(uuid)'::regprocedure),
  'get_consultation_post は consultant_id を返さない'
);

-- 3-6. anon は呼べない(お悩み一覧はログイン後のタブにだけある)
select is(has_function_privilege('anon', 'public.list_consultation_posts()', 'execute'),
  false, 'anon は list_consultation_posts を実行できない');
select is(has_function_privilege('anon', 'public.get_consultation_post(uuid)', 'execute'),
  false, 'anon は get_consultation_post を実行できない');
select is(has_function_privilege('anon', 'public.list_my_consultation_posts()', 'execute'),
  false, 'anon は list_my_consultation_posts を実行できない');
select is(has_function_privilege('anon', 'public.close_consultation_post(uuid)', 'execute'),
  false, 'anon は close_consultation_post を実行できない');

-- ===== bob(占い師)=====
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000c2","role":"authenticated"}', true);

-- 7. 一覧は募集中・対応中だけを新着順で返す(閉じた p2 は返らない)
select is(
  (select array_agg(id) from public.list_consultation_posts()),
  array['00000000-0000-0000-0000-0000000000d3', '00000000-0000-0000-0000-0000000000d4',
        '00000000-0000-0000-0000-0000000000d1']::uuid[],
  '一覧は open / in_progress の投稿を新着順で返す'
);

-- 8. 悩みタグの名前と、自分の投稿か・応募済みかを返す
select results_eq(
  $$ select id, concern_tag_name, is_mine, has_applied from public.list_consultation_posts() order by concern $$,
  $$ values ('00000000-0000-0000-0000-0000000000d1'::uuid, 'テスト悩みA', false, true),
            ('00000000-0000-0000-0000-0000000000d3'::uuid, 'テスト悩みA', true,  false),
            ('00000000-0000-0000-0000-0000000000d4'::uuid, 'テスト悩みA', false, false) $$,
  '一覧は悩みタグの名前・is_mine・has_applied を返す'
);

-- 9. 他人の閉じた投稿は詳細も取れない
select is(
  (select count(*)::int from public.get_consultation_post('00000000-0000-0000-0000-0000000000d2')),
  0, '他人の閉じた投稿は get_consultation_post で取れない'
);

-- 10. 他人の募集中の投稿は詳細が取れる(応募済みも分かる)
select results_eq(
  $$ select concern, is_mine, has_applied from public.get_consultation_post('00000000-0000-0000-0000-0000000000d1') $$,
  $$ values ('p1'::text, false, true) $$,
  '他人の募集中の投稿は get_consultation_post で取れる'
);

-- 11. 自分の投稿の一覧には自分の投稿だけが入る
select is(
  (select array_agg(id) from public.list_my_consultation_posts()),
  array['00000000-0000-0000-0000-0000000000d3']::uuid[],
  'list_my_consultation_posts は自分の投稿だけを返す'
);

-- 12. 他人の投稿は閉じられない
select throws_ok(
  $$ select public.close_consultation_post('00000000-0000-0000-0000-0000000000d1') $$,
  'P0001', 'only the owner can close the post',
  '他人の投稿は閉じられない'
);
reset role;

-- ===== alice(投稿者)=====
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}', true);

-- 13. 自分の投稿の一覧には閉じた投稿も入り、新着順に並ぶ
select is(
  (select array_agg(id) from public.list_my_consultation_posts()),
  array['00000000-0000-0000-0000-0000000000d4', '00000000-0000-0000-0000-0000000000d1',
        '00000000-0000-0000-0000-0000000000d2']::uuid[],
  'list_my_consultation_posts は閉じた投稿も新着順で返す'
);

-- 14. 自分の閉じた投稿は詳細が取れる
select is(
  (select count(*)::int from public.get_consultation_post('00000000-0000-0000-0000-0000000000d2')),
  1, '自分の閉じた投稿は get_consultation_post で取れる'
);

-- 15. 自分の投稿は閉じられる
select lives_ok(
  $$ select public.close_consultation_post('00000000-0000-0000-0000-0000000000d1') $$,
  '自分の投稿は閉じられる'
);

-- 16. 閉じた投稿は一覧から消える
select is(
  (select count(*)::int from public.list_consultation_posts()
    where id = '00000000-0000-0000-0000-0000000000d1'),
  0, '閉じた投稿は一覧に出ない'
);

-- 17. 閉じた投稿をもう一度閉じてもエラーにしない(二度押しなど)
select lives_ok(
  $$ select public.close_consultation_post('00000000-0000-0000-0000-0000000000d1') $$,
  '閉じた投稿をもう一度閉じてもエラーにならない'
);

-- 18. 存在しない投稿は閉じられない
select throws_ok(
  $$ select public.close_consultation_post(gen_random_uuid()) $$,
  'P0001', 'only the owner can close the post',
  '存在しない投稿は閉じられない'
);
reset role;

-- ===== ブロック(この時点の一覧は bob の p3 と alice の p4)=====
-- 19-20. bob が alice をブロックすると、bob には alice の投稿が一覧にも詳細にも出ない(自分の投稿は出る)
insert into public.blocks (blocker_id, blocked_id) values
  ('00000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-0000000000c1');

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000c2","role":"authenticated"}', true);
select is(
  (select array_agg(id) from public.list_consultation_posts()),
  array['00000000-0000-0000-0000-0000000000d3']::uuid[],
  'ブロックした相手の投稿は一覧に出ない'
);
select is_empty(
  $$ select * from public.get_consultation_post('00000000-0000-0000-0000-0000000000d4') $$,
  'ブロックした相手の投稿は詳細も取れない'
);
reset role;

-- 21-22. alice が bob をブロックしても(逆の向き)、bob には alice の投稿が出ない
delete from public.blocks where blocker_id = '00000000-0000-0000-0000-0000000000c2';
insert into public.blocks (blocker_id, blocked_id) values
  ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000c2');

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000c2","role":"authenticated"}', true);
select is(
  (select array_agg(id) from public.list_consultation_posts()),
  array['00000000-0000-0000-0000-0000000000d3']::uuid[],
  'ブロックされた相手の投稿は一覧に出ない'
);
select is_empty(
  $$ select * from public.get_consultation_post('00000000-0000-0000-0000-0000000000d4') $$,
  'ブロックされた相手の投稿は詳細も取れない'
);
reset role;

-- 23. 解除すると、元どおり出る
delete from public.blocks where blocker_id = '00000000-0000-0000-0000-0000000000c1';

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000c2","role":"authenticated"}', true);
select is(
  (select array_agg(id) from public.list_consultation_posts()),
  array['00000000-0000-0000-0000-0000000000d3', '00000000-0000-0000-0000-0000000000d4']::uuid[],
  'ブロックを解除すると、相手の投稿が一覧に出る'
);
reset role;

select * from finish();
rollback;
