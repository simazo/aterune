begin;
select plan(21);

-- ===== テストデータ(postgres 権限) =====
-- alice=投稿者(占い師でもある)/ bob,dave,erin=占い師 / carol=占い師ではない
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000c1', 'alice@example.com'),
  ('00000000-0000-0000-0000-0000000000c2', 'bob@example.com'),
  ('00000000-0000-0000-0000-0000000000c3', 'carol@example.com'),
  ('00000000-0000-0000-0000-0000000000c4', 'dave@example.com'),
  ('00000000-0000-0000-0000-0000000000c5', 'erin@example.com');

insert into public.teller_profiles (profile_id) values
  ('00000000-0000-0000-0000-0000000000c1'),
  ('00000000-0000-0000-0000-0000000000c2'),
  ('00000000-0000-0000-0000-0000000000c4'),
  ('00000000-0000-0000-0000-0000000000c5');

-- seed に依存しないよう、テスト用の悩みタグを作る
insert into public.tags (id, category, slug, name) values
  ('00000000-0000-0000-0000-0000000000e1', 'concern', 'test-concern-a', 'テスト悩みA');

-- p1=open / p2=closed / p3=in_progress / p4=open(すべて alice の投稿)
insert into public.consultation_posts (id, consultant_id, concern_tag_id, concern, status) values
  ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000e1', 'p1の悩み', 'open'),
  ('00000000-0000-0000-0000-0000000000d2', '00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000e1', 'p2の悩み', 'closed'),
  ('00000000-0000-0000-0000-0000000000d3', '00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000e1', 'p3の悩み', 'in_progress'),
  ('00000000-0000-0000-0000-0000000000d4', '00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000e1', 'p4の悩み', 'open');

-- 1-2. 呼べるのはログイン中のユーザーだけ
select is(has_function_privilege('anon', 'public.apply_to_consultation_post(uuid, text)', 'execute'),
  false, 'anon は apply_to_consultation_post を実行できない');
select is(has_function_privilege('authenticated', 'public.apply_to_consultation_post(uuid, text)', 'execute'),
  true, 'authenticated は apply_to_consultation_post を実行できる');

-- ===== bob(占い師)=====
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000c2","role":"authenticated"}', true);

-- 3. 占い師は募集中の投稿に応募できる
select lives_ok(
  $$ select public.apply_to_consultation_post('00000000-0000-0000-0000-0000000000d1', 'よろしくお願いします') $$,
  '占い師は募集中の投稿に応募できる'
);

-- 4. 投稿者の ID が見えなくても、申込みの向き・当事者・内容が正しく入る
select results_eq(
  $$ select applicant_id, recipient_id, consultant_id, teller_id, initiated_by, status,
            concern, concern_tag_id, applicant_message
       from public.sessions
      where post_id = '00000000-0000-0000-0000-0000000000d1' $$,
  $$ values ('00000000-0000-0000-0000-0000000000c2'::uuid, '00000000-0000-0000-0000-0000000000c1'::uuid,
             '00000000-0000-0000-0000-0000000000c1'::uuid, '00000000-0000-0000-0000-0000000000c2'::uuid,
             'teller'::text, 'pending'::text, 'p1の悩み'::text,
             '00000000-0000-0000-0000-0000000000e1'::uuid, 'よろしくお願いします'::text) $$,
  '応募したセッションに当事者・向き・投稿の内容とタグ・ひとことが入る'
);

-- 5. 存在しない投稿には応募できない
select throws_ok(
  $$ select public.apply_to_consultation_post(gen_random_uuid(), null) $$,
  'P0001', 'the post does not exist',
  '存在しない投稿には応募できない'
);
reset role;

-- 6. 投稿者に応募の通知が届く
select is(
  (select count(*)::int from public.notifications n
     join public.sessions s on s.id = n.session_id
    where s.post_id = '00000000-0000-0000-0000-0000000000d1'
      and n.recipient_id = '00000000-0000-0000-0000-0000000000c1'
      and n.type = 'session_request_received'),
  1, '応募すると投稿者に session_request_received の通知が作られる'
);

-- ===== carol(占い師ではない)=====
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000c3","role":"authenticated"}', true);

-- 7. 占い師でなければ応募できない
select throws_ok(
  $$ select public.apply_to_consultation_post('00000000-0000-0000-0000-0000000000d4', null) $$,
  'P0001', 'only tellers can apply to a post',
  '占い師でなければ応募できない'
);
reset role;

-- ===== alice(投稿者)=====
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}', true);

-- 8. 自分の投稿には応募できない
select throws_ok(
  $$ select public.apply_to_consultation_post('00000000-0000-0000-0000-0000000000d4', null) $$,
  'P0001', 'cannot apply to your own post',
  '自分の投稿には応募できない'
);

-- bob の応募を拒否する(9 で使う)
update public.sessions set status = 'rejected'
 where post_id = '00000000-0000-0000-0000-0000000000d1'
   and teller_id = '00000000-0000-0000-0000-0000000000c2';
reset role;

-- ===== bob(占い師)=====
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000c2","role":"authenticated"}', true);

-- 9. 同じ投稿へは、拒否されたあとも再び応募できない
select throws_ok(
  $$ select public.apply_to_consultation_post('00000000-0000-0000-0000-0000000000d1', null) $$,
  '23505', null,
  '同じ投稿へは拒否されたあとも応募できない'
);

-- 10. 同じ投稿者の別の投稿には応募できる(拒否された投稿以外)
select lives_ok(
  $$ select public.apply_to_consultation_post('00000000-0000-0000-0000-0000000000d4', null) $$,
  '同じ投稿者の別の投稿には応募できる'
);
reset role;

-- ===== dave(占い師)=====
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000c4","role":"authenticated"}', true);

-- 11. 対応中の投稿にも応募できる(本人が閉じるまで募集を続ける)
select lives_ok(
  $$ select public.apply_to_consultation_post('00000000-0000-0000-0000-0000000000d3', null) $$,
  '対応中の投稿にも応募できる'
);
reset role;

-- ===== erin(占い師)=====
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000c5","role":"authenticated"}', true);

-- 12. 閉じた投稿には応募できない
select throws_ok(
  $$ select public.apply_to_consultation_post('00000000-0000-0000-0000-0000000000d2', null) $$,
  'P0001', 'cannot apply to a closed post',
  '閉じた投稿には応募できない'
);

-- 13. ひとことは100文字まで
select throws_ok(
  $$ select public.apply_to_consultation_post('00000000-0000-0000-0000-0000000000d1', repeat('あ', 101)) $$,
  '23514', null,
  'ひとことが101文字なら応募できない'
);

-- erin も p4 に応募する(15〜17 で使う。bob は 10 で p4 に応募済み)
select public.apply_to_consultation_post('00000000-0000-0000-0000-0000000000d4', null);
reset role;

-- ===== 未ログイン(authenticated ロールだが、claims が無い)=====
set local role authenticated;
select set_config('request.jwt.claims', '', true);

-- 14. ログインしていなければ応募できない
select throws_ok(
  $$ select public.apply_to_consultation_post('00000000-0000-0000-0000-0000000000d4', null) $$,
  'P0001', 'not authenticated',
  'ログインしていなければ応募できない'
);
reset role;

-- ===== alice(投稿者)=====
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}', true);

-- 15. 1つの投稿への複数の応募を、どれも承認できる
select lives_ok(
  $$ update public.sessions set status = 'active'
      where post_id = '00000000-0000-0000-0000-0000000000d4' $$,
  '1つの投稿への複数の応募をどれも承認できる'
);
reset role;
select set_config('request.jwt.claims', '', true);

-- 16. 承認した2件が進行中になり、投稿は対応中になる
select results_eq(
  $$ select (select count(*)::int from public.sessions
              where post_id = '00000000-0000-0000-0000-0000000000d4' and status = 'active'),
            (select status from public.consultation_posts
              where id = '00000000-0000-0000-0000-0000000000d4') $$,
  $$ values (2, 'in_progress'::text) $$,
  '複数を承認すると、すべて進行中になり投稿は対応中になる'
);

-- 17. 1件を完了しても、ほかに進行中があれば投稿は対応中のまま
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}', true);
update public.sessions set status = 'completed'
 where post_id = '00000000-0000-0000-0000-0000000000d4'
   and teller_id = '00000000-0000-0000-0000-0000000000c2';
reset role;

select is(
  (select status from public.consultation_posts where id = '00000000-0000-0000-0000-0000000000d4'),
  'in_progress',
  '1件を完了しても、ほかに進行中があれば投稿は対応中のまま'
);

-- 18. 退会したユーザーの投稿には応募できない。
--     退会の処理(prepare_account_deletion)で投稿は閉じるが、閉じていなくても応募は弾く(frank=退会した投稿者)
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000c6', 'frank@example.com');
insert into public.consultation_posts (id, consultant_id, concern_tag_id, concern, status) values
  ('00000000-0000-0000-0000-0000000000d5', '00000000-0000-0000-0000-0000000000c6', '00000000-0000-0000-0000-0000000000e1', 'p5の悩み', 'open');
update public.profiles set deleted_at = now() where id = '00000000-0000-0000-0000-0000000000c6';

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000c2","role":"authenticated"}', true);
select throws_ok(
  $$ select public.apply_to_consultation_post('00000000-0000-0000-0000-0000000000d5') $$,
  'P0001', 'the recipient has deleted the account',
  '退会したユーザーの投稿には応募できない'
);
reset role;

-- ===== ブロック(gina=占い師、p6=alice の募集中の投稿)=====
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000c7', 'gina@example.com');
insert into public.teller_profiles (profile_id) values
  ('00000000-0000-0000-0000-0000000000c7');
insert into public.consultation_posts (id, consultant_id, concern_tag_id, concern, status) values
  ('00000000-0000-0000-0000-0000000000d6', '00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000e1', 'p6の悩み', 'open');

-- 19. 占い師が投稿者をブロックしていると、応募できない
insert into public.blocks (blocker_id, blocked_id) values
  ('00000000-0000-0000-0000-0000000000c7', '00000000-0000-0000-0000-0000000000c1');

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000c7","role":"authenticated"}', true);
select throws_ok(
  $$ select public.apply_to_consultation_post('00000000-0000-0000-0000-0000000000d6') $$,
  'P0001', 'cannot send a request to this user',
  'ブロックした相手の投稿には応募できない'
);
reset role;

-- 20. 投稿者が占い師をブロックしていても(逆の向き)、応募できない
delete from public.blocks where blocker_id = '00000000-0000-0000-0000-0000000000c7';
insert into public.blocks (blocker_id, blocked_id) values
  ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000c7');

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000c7","role":"authenticated"}', true);
select throws_ok(
  $$ select public.apply_to_consultation_post('00000000-0000-0000-0000-0000000000d6') $$,
  'P0001', 'cannot send a request to this user',
  'ブロックされた相手の投稿には応募できない'
);
reset role;

-- 21. 解除すると、元どおり応募できる
delete from public.blocks where blocker_id = '00000000-0000-0000-0000-0000000000c1';

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000c7","role":"authenticated"}', true);
select lives_ok(
  $$ select public.apply_to_consultation_post('00000000-0000-0000-0000-0000000000d6') $$,
  'ブロックを解除すると応募できる'
);
reset role;

select * from finish();
rollback;
