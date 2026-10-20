begin;
select plan(67);

-- ===== テストデータ(postgres 権限) =====
-- alice=占い師でもある相談者 / bob=占い師 / carol=占い師ではない一般ユーザー / dave=占い師(完了数・制約用)
-- erin,frank,gwen=占い師(同じ相談者と占い師の間で承認待ち・進行中は1件までなので、セッションごとに相手を分ける)
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000f1', 'alice@example.com'),
  ('00000000-0000-0000-0000-0000000000f2', 'bob@example.com'),
  ('00000000-0000-0000-0000-0000000000f3', 'carol@example.com'),
  ('00000000-0000-0000-0000-0000000000f4', 'dave@example.com'),
  ('00000000-0000-0000-0000-0000000000f5', 'erin@example.com'),
  ('00000000-0000-0000-0000-0000000000f6', 'frank@example.com'),
  ('00000000-0000-0000-0000-0000000000f7', 'gwen@example.com');

insert into public.teller_profiles (profile_id) values
  ('00000000-0000-0000-0000-0000000000f1'),
  ('00000000-0000-0000-0000-0000000000f2'),
  ('00000000-0000-0000-0000-0000000000f4'),
  ('00000000-0000-0000-0000-0000000000f5'),
  ('00000000-0000-0000-0000-0000000000f6'),
  ('00000000-0000-0000-0000-0000000000f7');

-- alice の掲示板投稿(p1=open、p2=closed、p3=open)
insert into public.consultation_posts (id, consultant_id, category, concern, status) values
  ('00000000-0000-0000-0000-000000000a01', '00000000-0000-0000-0000-0000000000f1', '恋愛', 'aliceの悩み', 'open'),
  ('00000000-0000-0000-0000-000000000a02', '00000000-0000-0000-0000-0000000000f1', '仕事', '閉じた悩み',   'closed'),
  ('00000000-0000-0000-0000-000000000a03', '00000000-0000-0000-0000-0000000000f1', '健康', 'aliceの別の悩み', 'open');

-- s4: carol → bob の期限切れの pending。
-- s1 より先に作る(期限切れの pending は二重申込みとして数えないので、後から s1 を作れる)
insert into public.sessions
  (id, applicant_id, recipient_id, consultant_id, teller_id, initiated_by, concern, status, expires_at)
values
  ('00000000-0000-0000-0000-000000000504', '00000000-0000-0000-0000-0000000000f3', '00000000-0000-0000-0000-0000000000f2',
   '00000000-0000-0000-0000-0000000000f3', '00000000-0000-0000-0000-0000000000f2', 'consultant', 's4', 'pending', now() - interval '1 hour');

-- s1: carol → bob の申込み(pending)/ s2: carol → erin(pending)/ s3: carol → frank(active)/ s6: carol → gwen(拒否用の pending)
insert into public.sessions
  (id, applicant_id, recipient_id, consultant_id, teller_id, initiated_by, concern, status)
values
  ('00000000-0000-0000-0000-000000000501', '00000000-0000-0000-0000-0000000000f3', '00000000-0000-0000-0000-0000000000f2',
   '00000000-0000-0000-0000-0000000000f3', '00000000-0000-0000-0000-0000000000f2', 'consultant', 's1', 'pending'),
  ('00000000-0000-0000-0000-000000000502', '00000000-0000-0000-0000-0000000000f3', '00000000-0000-0000-0000-0000000000f5',
   '00000000-0000-0000-0000-0000000000f3', '00000000-0000-0000-0000-0000000000f5', 'consultant', 's2', 'pending'),
  ('00000000-0000-0000-0000-000000000503', '00000000-0000-0000-0000-0000000000f3', '00000000-0000-0000-0000-0000000000f6',
   '00000000-0000-0000-0000-0000000000f3', '00000000-0000-0000-0000-0000000000f6', 'consultant', 's3', 'active'),
  ('00000000-0000-0000-0000-000000000506', '00000000-0000-0000-0000-0000000000f3', '00000000-0000-0000-0000-0000000000f7',
   '00000000-0000-0000-0000-0000000000f3', '00000000-0000-0000-0000-0000000000f7', 'consultant', 's6', 'pending');

-- s5: bob が alice の投稿 p1 に応募(concern は投稿からコピーされる)/ s7: erin が alice の投稿 p3 に応募
insert into public.sessions
  (id, applicant_id, recipient_id, consultant_id, teller_id, initiated_by, post_id)
values
  ('00000000-0000-0000-0000-000000000505', '00000000-0000-0000-0000-0000000000f2', '00000000-0000-0000-0000-0000000000f1',
   '00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000f2', 'teller',
   '00000000-0000-0000-0000-000000000a01'),
  ('00000000-0000-0000-0000-000000000507', '00000000-0000-0000-0000-0000000000f5', '00000000-0000-0000-0000-0000000000f1',
   '00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000f5', 'teller',
   '00000000-0000-0000-0000-000000000a03');

-- 1. RLS が有効
select ok(
  (select relrowsecurity from pg_class where oid = 'public.sessions'::regclass),
  'sessions: RLS が有効'
);

-- 2. updated_at トリガー(トリガー名は既存の命名に合わせる)
select has_trigger('public', 'sessions', 'sessions_set_updated_at', 'sessions: updated_at トリガーがある');

-- 3. expires_at の初期値は作成から48時間後
select is(
  (select expires_at - created_at from public.sessions where id = '00000000-0000-0000-0000-000000000501'),
  interval '48 hours',
  'expires_at の初期値は created_at + 48時間'
);

-- 4. 掲示板経由なら concern が投稿からコピーされる
select is(
  (select concern from public.sessions where id = '00000000-0000-0000-0000-000000000505'),
  'aliceの悩み',
  'post_id があれば concern が投稿からコピーされる'
);

-- ===== anon =====
set local role anon;

-- 5. anon は select できない
select throws_ok($$ select * from public.sessions $$, '42501', null, 'anon は sessions を select できない');

-- 6. anon は insert できない
select throws_ok(
  $$ insert into public.sessions (applicant_id, recipient_id, consultant_id, teller_id, initiated_by, concern)
     values ('00000000-0000-0000-0000-0000000000f3', '00000000-0000-0000-0000-0000000000f2',
             '00000000-0000-0000-0000-0000000000f3', '00000000-0000-0000-0000-0000000000f2', 'consultant', 'x') $$,
  '42501', null, 'anon は sessions を insert できない'
);
reset role;

-- ===== carol(相談者として申し込む側)=====
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000f3","role":"authenticated"}', true);

-- 7. 自分が当事者のセッションは見える
select is(
  (select count(*)::int from public.sessions where id = '00000000-0000-0000-0000-000000000501'),
  1, '当事者は自分のセッションを select できる'
);

-- 8. 自分名義で申込みできる
select lives_ok(
  $$ insert into public.sessions (applicant_id, recipient_id, consultant_id, teller_id, initiated_by, concern)
     values ('00000000-0000-0000-0000-0000000000f3', '00000000-0000-0000-0000-0000000000f1',
             '00000000-0000-0000-0000-0000000000f3', '00000000-0000-0000-0000-0000000000f1', 'consultant', 'carolの新規申込') $$,
  '自分名義で申込みできる'
);

-- 9. 他人名義(applicant_id が自分でない)では申込みできない
select throws_ok(
  $$ insert into public.sessions (applicant_id, recipient_id, consultant_id, teller_id, initiated_by, concern)
     values ('00000000-0000-0000-0000-0000000000f2', '00000000-0000-0000-0000-0000000000f1',
             '00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000f2', 'teller', 'なりすまし') $$,
  '42501', null, '他人名義では申込みできない'
);

-- 10. insert 時に status は指定できない(列 GRANT)
select throws_ok(
  $$ insert into public.sessions (applicant_id, recipient_id, consultant_id, teller_id, initiated_by, concern, status)
     values ('00000000-0000-0000-0000-0000000000f3', '00000000-0000-0000-0000-0000000000f2',
             '00000000-0000-0000-0000-0000000000f3', '00000000-0000-0000-0000-0000000000f2', 'consultant', 'x', 'active') $$,
  '42501', null, 'insert 時に status は指定できない'
);

-- 11. insert 時に expires_at は指定できない(列 GRANT)
select throws_ok(
  $$ insert into public.sessions (applicant_id, recipient_id, consultant_id, teller_id, initiated_by, concern, expires_at)
     values ('00000000-0000-0000-0000-0000000000f3', '00000000-0000-0000-0000-0000000000f2',
             '00000000-0000-0000-0000-0000000000f3', '00000000-0000-0000-0000-0000000000f2', 'consultant', 'x', now() + interval '365 days') $$,
  '42501', null, 'insert 時に expires_at は指定できない'
);

-- 12. initiated_by と申込者の役割が食い違う行は作れない
-- (CHECK 制約は BEFORE トリガーの後に確かめられるため、二重申込みに当たらない dave との組み合わせにする)
select throws_ok(
  $$ insert into public.sessions (applicant_id, recipient_id, consultant_id, teller_id, initiated_by, concern)
     values ('00000000-0000-0000-0000-0000000000f3', '00000000-0000-0000-0000-0000000000f4',
             '00000000-0000-0000-0000-0000000000f3', '00000000-0000-0000-0000-0000000000f4', 'teller', 'x') $$,
  '23514', null, 'initiated_by と申込者の役割が食い違う行は作れない'
);

-- 13. 占い師でない人は占い師側になれない(外部キー)
select throws_ok(
  $$ insert into public.sessions (applicant_id, recipient_id, consultant_id, teller_id, initiated_by, concern)
     values ('00000000-0000-0000-0000-0000000000f3', '00000000-0000-0000-0000-0000000000f2',
             '00000000-0000-0000-0000-0000000000f2', '00000000-0000-0000-0000-0000000000f3', 'teller', 'x') $$,
  '23503', null, '占い師でない人は teller_id になれない'
);

-- 14. concern は更新できない(update は status 列のみ)
select throws_ok(
  $$ update public.sessions set concern = '書き換え' where id = '00000000-0000-0000-0000-000000000501' $$,
  '42501', null, 'status 以外の列は update できない'
);

-- 15. 申込んだ側は自分の申込みを承認できない
select throws_ok(
  $$ update public.sessions set status = 'active' where id = '00000000-0000-0000-0000-000000000502' $$,
  'P0001', null, '申込んだ側は pending → active にできない'
);

-- 16. 利用者は expired にできない
select throws_ok(
  $$ update public.sessions set status = 'expired' where id = '00000000-0000-0000-0000-000000000502' $$,
  'P0001', null, '利用者は status を expired にできない'
);

-- 41. 申込んだ側は自分の申込みを拒否できない
select throws_ok(
  $$ update public.sessions set status = 'rejected' where id = '00000000-0000-0000-0000-000000000506' $$,
  'P0001', null, '申込んだ側は pending → rejected にできない'
);

-- 17. delete はできない
select throws_ok(
  $$ delete from public.sessions where id = '00000000-0000-0000-0000-000000000501' $$,
  '42501', null, 'authenticated は sessions を delete できない'
);
reset role;

-- 18. 申込み直後の status は pending
select is(
  (select status from public.sessions where concern = 'carolの新規申込'),
  'pending', '申込み直後の status は pending'
);

-- ===== alice =====
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000f1","role":"authenticated"}', true);

-- 19. 当事者でない人には見えない
select is(
  (select count(*)::int from public.sessions where id = '00000000-0000-0000-0000-000000000501'),
  0, '当事者でない人には sessions が見えない'
);

-- 20. 占い師でも、相談者として別の占い師に申し込める(相互相談)
select lives_ok(
  $$ insert into public.sessions (applicant_id, recipient_id, consultant_id, teller_id, initiated_by, concern)
     values ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000f6',
             '00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000f6', 'consultant', '占い師aliceの相談') $$,
  '占い師が相談者として別の占い師に申し込める'
);
reset role;

-- ===== bob(申し込まれた側・占い師)=====
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000f2","role":"authenticated"}', true);

-- 21. 申し込まれた側は承認できる
select lives_ok(
  $$ update public.sessions set status = 'active' where id = '00000000-0000-0000-0000-000000000501' $$,
  '申し込まれた側は pending → active にできる'
);

-- 23. closed の投稿には応募できない
select throws_ok(
  $$ insert into public.sessions (applicant_id, recipient_id, consultant_id, teller_id, initiated_by, post_id)
     values ('00000000-0000-0000-0000-0000000000f2', '00000000-0000-0000-0000-0000000000f1',
             '00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000f2', 'teller',
             '00000000-0000-0000-0000-000000000a02') $$,
  'P0001', 'cannot apply to a closed post', 'closed の投稿には応募できない'
);

-- 24. 応募先が投稿者でなければ作れない
select throws_ok(
  $$ insert into public.sessions (applicant_id, recipient_id, consultant_id, teller_id, initiated_by, post_id)
     values ('00000000-0000-0000-0000-0000000000f2', '00000000-0000-0000-0000-0000000000f3',
             '00000000-0000-0000-0000-0000000000f3', '00000000-0000-0000-0000-0000000000f2', 'teller',
             '00000000-0000-0000-0000-000000000a01') $$,
  'P0001', 'a post session must be initiated by a teller toward the post owner', 'recipient が投稿者でなければ作れない'
);

-- 25. 期限切れの pending は承認できない
select throws_ok(
  $$ update public.sessions set status = 'active' where id = '00000000-0000-0000-0000-000000000504' $$,
  'P0001', null, '期限切れの pending は承認できない'
);
reset role;

-- ===== frank(s3 の占い師)=====
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000f6","role":"authenticated"}', true);

-- 22. 占い師は完了操作できない(相談者のみ)
select throws_ok(
  $$ update public.sessions set status = 'completed' where id = '00000000-0000-0000-0000-000000000503' $$,
  'P0001', null, '占い師側は active → completed にできない'
);
reset role;

-- ===== gwen(s6 の占い師)=====
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000f7","role":"authenticated"}', true);

-- 42. 申し込まれた側は拒否できる
select lives_ok(
  $$ update public.sessions set status = 'rejected' where id = '00000000-0000-0000-0000-000000000506' $$,
  '申し込まれた側は pending → rejected にできる'
);

-- 26. 占い師は open の投稿に応募できる(alice の投稿 p1。bob は s5 で応募済みなので、gwen が応募する)
select lives_ok(
  $$ insert into public.sessions (applicant_id, recipient_id, consultant_id, teller_id, initiated_by, post_id)
     values ('00000000-0000-0000-0000-0000000000f7', '00000000-0000-0000-0000-0000000000f1',
             '00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000f7', 'teller',
             '00000000-0000-0000-0000-000000000a01') $$,
  '占い師は open の投稿に応募できる'
);
reset role;

-- ===== carol(相談者)が完了操作 =====
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000f3","role":"authenticated"}', true);

-- 43. 利用者は auto_completed にできない(システムのみ)
select throws_ok(
  $$ update public.sessions set status = 'auto_completed' where id = '00000000-0000-0000-0000-000000000503' $$,
  'P0001', null, '利用者は active → auto_completed にできない'
);

-- 27. 相談者は active → completed にできる
select lives_ok(
  $$ update public.sessions set status = 'completed' where id = '00000000-0000-0000-0000-000000000503' $$,
  '相談者は active → completed にできる'
);

-- 29. 終了したセッションは元に戻せない
select throws_ok(
  $$ update public.sessions set status = 'active' where id = '00000000-0000-0000-0000-000000000503' $$,
  'P0001', null, 'completed から active には戻せない'
);
reset role;

-- 28. completed_at が自動で入る
select isnt(
  (select completed_at from public.sessions where id = '00000000-0000-0000-0000-000000000503'),
  null, 'completed への遷移で completed_at が設定される'
);

-- ===== システム(service_role / postgres)=====
-- 直前のユーザーの claims が残っているので消す(set_config(..., true) はトランザクション内で残る)
select set_config('request.jwt.claims', '', true);

-- 30. システムは pending → expired にできる
select lives_ok(
  $$ update public.sessions set status = 'expired' where id = '00000000-0000-0000-0000-000000000502' $$,
  'システムは pending → expired にできる'
);

-- 31. システムは active → auto_completed にできる(s1 は 21 で active になっている)
select lives_ok(
  $$ update public.sessions set status = 'auto_completed' where id = '00000000-0000-0000-0000-000000000501' $$,
  'システムは active → auto_completed にできる'
);

-- 32. auto_completed でも completed_at が設定される
select isnt(
  (select completed_at from public.sessions where id = '00000000-0000-0000-0000-000000000501'),
  null, 'auto_completed への遷移で completed_at が設定される'
);

-- 33. システムでも終了済みからは戻せない
select throws_ok(
  $$ update public.sessions set status = 'active' where id = '00000000-0000-0000-0000-000000000501' $$,
  'P0001', null, 'システムでも auto_completed から active には戻せない'
);

-- ===== 投稿ステータスとの連動(s5: bob → alice の投稿 p1)=====
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000f1","role":"authenticated"}', true);

-- 34. 投稿者(申し込まれた側)が承認
select lives_ok(
  $$ update public.sessions set status = 'active' where id = '00000000-0000-0000-0000-000000000505' $$,
  '投稿者は応募を承認できる'
);
reset role;

-- 35. 承認で投稿が in_progress になる
select is(
  (select status from public.consultation_posts where id = '00000000-0000-0000-0000-000000000a01'),
  'in_progress', 'active なセッションがあれば投稿は in_progress になる'
);

-- 投稿者が投稿を閉じる(postgres で代行)
update public.consultation_posts set status = 'closed' where id = '00000000-0000-0000-0000-000000000a01';

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000f1","role":"authenticated"}', true);

-- 36. 相談者(alice)が完了
select lives_ok(
  $$ update public.sessions set status = 'completed' where id = '00000000-0000-0000-0000-000000000505' $$,
  '相談者(投稿者)は完了できる'
);
reset role;

-- 37. 閉じた投稿は、セッションが終わっても open に戻らない
select is(
  (select status from public.consultation_posts where id = '00000000-0000-0000-0000-000000000a01'),
  'closed', 'closed の投稿はセッションの状態変化で上書きされない'
);

-- ===== 投稿ステータスとの連動(s7: erin → alice の投稿 p3、投稿は閉じない)=====
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000f1","role":"authenticated"}', true);

-- alice が承認(p3 は in_progress になる)してから完了する
update public.sessions set status = 'active'    where id = '00000000-0000-0000-0000-000000000507';
update public.sessions set status = 'completed' where id = '00000000-0000-0000-0000-000000000507';
reset role;

-- 44. closed でない投稿は、active なセッションが無くなると open に戻る
select is(
  (select status from public.consultation_posts where id = '00000000-0000-0000-0000-000000000a03'),
  'open', 'active なセッションが無くなれば投稿は in_progress から open に戻る'
);

-- ===== 制約(postgres 権限)=====
select set_config('request.jwt.claims', '', true);

-- 38. 自分自身への申込みは作れない
select throws_ok(
  $$ insert into public.sessions (applicant_id, recipient_id, consultant_id, teller_id, initiated_by, concern)
     values ('00000000-0000-0000-0000-0000000000f3', '00000000-0000-0000-0000-0000000000f3',
             '00000000-0000-0000-0000-0000000000f3', '00000000-0000-0000-0000-0000000000f2', 'consultant', 'x') $$,
  '23514', null, '自分自身への申込みは作れない'
);

-- 39. concern は NOT NULL(掲示板経由でない場合)
select throws_ok(
  $$ insert into public.sessions (applicant_id, recipient_id, consultant_id, teller_id, initiated_by)
     values ('00000000-0000-0000-0000-0000000000f3', '00000000-0000-0000-0000-0000000000f2',
             '00000000-0000-0000-0000-0000000000f3', '00000000-0000-0000-0000-0000000000f2', 'consultant') $$,
  '23502', null, 'concern は NULL にできない'
);

-- 40. 想定外の status は入らない
select throws_ok(
  $$ insert into public.sessions (applicant_id, recipient_id, consultant_id, teller_id, initiated_by, concern, status)
     values ('00000000-0000-0000-0000-0000000000f3', '00000000-0000-0000-0000-0000000000f2',
             '00000000-0000-0000-0000-0000000000f3', '00000000-0000-0000-0000-0000000000f2', 'consultant', 'x', 'done') $$,
  '23514', null, '想定外の status は入らない'
);

-- 50. concern は 1000 文字まで
select throws_ok(
  $$ insert into public.sessions (applicant_id, recipient_id, consultant_id, teller_id, initiated_by, concern)
     values ('00000000-0000-0000-0000-0000000000f3', '00000000-0000-0000-0000-0000000000f2',
             '00000000-0000-0000-0000-0000000000f3', '00000000-0000-0000-0000-0000000000f2', 'consultant', repeat('あ', 1001)) $$,
  '23514', null, 'concern は 1001 文字以上にできない'
);

-- 51. applicant_message は 100 文字まで
select throws_ok(
  $$ insert into public.sessions (applicant_id, recipient_id, consultant_id, teller_id, initiated_by, concern, applicant_message)
     values ('00000000-0000-0000-0000-0000000000f3', '00000000-0000-0000-0000-0000000000f2',
             '00000000-0000-0000-0000-0000000000f3', '00000000-0000-0000-0000-0000000000f2', 'consultant', 'x', repeat('あ', 101)) $$,
  '23514', null, 'applicant_message は 101 文字以上にできない'
);

-- 52. ちょうど上限の文字数なら入る
select lives_ok(
  $$ insert into public.sessions (applicant_id, recipient_id, consultant_id, teller_id, initiated_by, concern, applicant_message)
     values ('00000000-0000-0000-0000-0000000000f3', '00000000-0000-0000-0000-0000000000f2',
             '00000000-0000-0000-0000-0000000000f3', '00000000-0000-0000-0000-0000000000f2', 'consultant', repeat('あ', 1000), repeat('あ', 100)) $$,
  'concern 1000 文字・applicant_message 100 文字なら入る'
);

-- ===== 受付停止中・生年月日必須(相談者からの申込みのみ)=====
-- hana=受付停止中の占い師 / ivan=生年月日必須の占い師
-- kate=生年月日が未入力(行はある)の相談者 / leo=生年月日を登録済みの相談者(carol は行が無い)
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000f8', 'hana@example.com'),
  ('00000000-0000-0000-0000-0000000000f9', 'ivan@example.com'),
  ('00000000-0000-0000-0000-0000000000fb', 'kate@example.com'),
  ('00000000-0000-0000-0000-0000000000fc', 'leo@example.com');

insert into public.teller_profiles (profile_id, is_accepting, requires_birthdate) values
  ('00000000-0000-0000-0000-0000000000f8', false, false),
  ('00000000-0000-0000-0000-0000000000f9', true,  true);

insert into public.profile_private_details (profile_id, birthdate) values
  ('00000000-0000-0000-0000-0000000000fb', null),
  ('00000000-0000-0000-0000-0000000000fc', '1990-01-01');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000f3","role":"authenticated"}', true);

-- 53. 受付停止中の占い師には申し込めない
select throws_ok(
  $$ insert into public.sessions (applicant_id, recipient_id, consultant_id, teller_id, initiated_by, concern)
     values ('00000000-0000-0000-0000-0000000000f3', '00000000-0000-0000-0000-0000000000f8',
             '00000000-0000-0000-0000-0000000000f3', '00000000-0000-0000-0000-0000000000f8', 'consultant', 'x') $$,
  'P0001', 'the teller is not accepting session requests', '受付停止中の占い師には申し込めない'
);

-- 54. 生年月日必須の占い師に、生年月日の行が無い相談者は申し込めない
select throws_ok(
  $$ insert into public.sessions (applicant_id, recipient_id, consultant_id, teller_id, initiated_by, concern)
     values ('00000000-0000-0000-0000-0000000000f3', '00000000-0000-0000-0000-0000000000f9',
             '00000000-0000-0000-0000-0000000000f3', '00000000-0000-0000-0000-0000000000f9', 'consultant', 'x') $$,
  'P0001', 'the teller requires the consultant''s birthdate', '生年月日必須の占い師に、生年月日の行が無い相談者は申し込めない'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000fb","role":"authenticated"}', true);

-- 55. 行があっても生年月日が未入力なら申し込めない
select throws_ok(
  $$ insert into public.sessions (applicant_id, recipient_id, consultant_id, teller_id, initiated_by, concern)
     values ('00000000-0000-0000-0000-0000000000fb', '00000000-0000-0000-0000-0000000000f9',
             '00000000-0000-0000-0000-0000000000fb', '00000000-0000-0000-0000-0000000000f9', 'consultant', 'x') $$,
  'P0001', 'the teller requires the consultant''s birthdate', '生年月日必須の占い師に、生年月日が未入力の相談者は申し込めない'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000fc","role":"authenticated"}', true);

-- 56. 生年月日を登録済みなら申し込める
select lives_ok(
  $$ insert into public.sessions (applicant_id, recipient_id, consultant_id, teller_id, initiated_by, concern)
     values ('00000000-0000-0000-0000-0000000000fc', '00000000-0000-0000-0000-0000000000f9',
             '00000000-0000-0000-0000-0000000000fc', '00000000-0000-0000-0000-0000000000f9', 'consultant', 'x') $$,
  '生年月日必須の占い師に、生年月日を登録済みの相談者は申し込める'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000f8","role":"authenticated"}', true);

-- 57. 受付停止中でも、占い師から掲示板投稿へは応募できる(p3 は 44 で open に戻っている)
select lives_ok(
  $$ insert into public.sessions (applicant_id, recipient_id, consultant_id, teller_id, initiated_by, post_id)
     values ('00000000-0000-0000-0000-0000000000f8', '00000000-0000-0000-0000-0000000000f1',
             '00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000f8', 'teller',
             '00000000-0000-0000-0000-000000000a03') $$,
  '受付停止中の占い師でも、掲示板投稿へは応募できる'
);
reset role;

-- ===== 二重申込み(同じ相談者と占い師の間で、期限内の pending か active は1件まで)=====
-- mika=相談者 / nao=占い師。m1: mika → nao の pending
select set_config('request.jwt.claims', '', true);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000fd', 'mika@example.com'),
  ('00000000-0000-0000-0000-0000000000fe', 'nao@example.com');

insert into public.teller_profiles (profile_id) values
  ('00000000-0000-0000-0000-0000000000fe');

insert into public.consultation_posts (id, consultant_id, concern) values
  ('00000000-0000-0000-0000-000000000a04', '00000000-0000-0000-0000-0000000000fd', 'mikaの悩み');

insert into public.sessions
  (id, applicant_id, recipient_id, consultant_id, teller_id, initiated_by, concern)
values
  ('00000000-0000-0000-0000-000000000901', '00000000-0000-0000-0000-0000000000fd', '00000000-0000-0000-0000-0000000000fe',
   '00000000-0000-0000-0000-0000000000fd', '00000000-0000-0000-0000-0000000000fe', 'consultant', 'm1');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000fd","role":"authenticated"}', true);

-- 58. pending があれば、同じ占い師に申し込めない
select throws_ok(
  $$ insert into public.sessions (applicant_id, recipient_id, consultant_id, teller_id, initiated_by, concern)
     values ('00000000-0000-0000-0000-0000000000fd', '00000000-0000-0000-0000-0000000000fe',
             '00000000-0000-0000-0000-0000000000fd', '00000000-0000-0000-0000-0000000000fe', 'consultant', 'x') $$,
  'P0001', 'an open session already exists between the consultant and the teller',
  '承認待ちのセッションがあれば、同じ占い師に申し込めない'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000fe","role":"authenticated"}', true);

-- 59. 逆向き(占い師から掲示板投稿への応募)でも弾く
select throws_ok(
  $$ insert into public.sessions (applicant_id, recipient_id, consultant_id, teller_id, initiated_by, post_id)
     values ('00000000-0000-0000-0000-0000000000fe', '00000000-0000-0000-0000-0000000000fd',
             '00000000-0000-0000-0000-0000000000fd', '00000000-0000-0000-0000-0000000000fe', 'teller',
             '00000000-0000-0000-0000-000000000a04') $$,
  'P0001', 'an open session already exists between the consultant and the teller',
  '承認待ちのセッションがあれば、占い師からも同じ相談者の投稿へ応募できない'
);
reset role;

-- 60. システムからの登録でも弾く
select set_config('request.jwt.claims', '', true);
select throws_ok(
  $$ insert into public.sessions (applicant_id, recipient_id, consultant_id, teller_id, initiated_by, concern)
     values ('00000000-0000-0000-0000-0000000000fd', '00000000-0000-0000-0000-0000000000fe',
             '00000000-0000-0000-0000-0000000000fd', '00000000-0000-0000-0000-0000000000fe', 'consultant', 'x') $$,
  'P0001', 'an open session already exists between the consultant and the teller',
  'システムからの登録でも二重申込みは弾く'
);

-- m1 を active にする(システムとして)
update public.sessions set status = 'active' where id = '00000000-0000-0000-0000-000000000901';

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000fd","role":"authenticated"}', true);

-- 61. active があれば申し込めない
select throws_ok(
  $$ insert into public.sessions (applicant_id, recipient_id, consultant_id, teller_id, initiated_by, concern)
     values ('00000000-0000-0000-0000-0000000000fd', '00000000-0000-0000-0000-0000000000fe',
             '00000000-0000-0000-0000-0000000000fd', '00000000-0000-0000-0000-0000000000fe', 'consultant', 'x') $$,
  'P0001', 'an open session already exists between the consultant and the teller',
  '進行中のセッションがあれば、同じ占い師に申し込めない'
);

-- mika が m1 を完了する
update public.sessions set status = 'completed' where id = '00000000-0000-0000-0000-000000000901';

-- 62. 完了後なら、また申し込める(m2)
select lives_ok(
  $$ insert into public.sessions (applicant_id, recipient_id, consultant_id, teller_id, initiated_by, concern)
     values ('00000000-0000-0000-0000-0000000000fd', '00000000-0000-0000-0000-0000000000fe',
             '00000000-0000-0000-0000-0000000000fd', '00000000-0000-0000-0000-0000000000fe', 'consultant', 'm2') $$,
  '完了したセッションしか無ければ、また申し込める'
);
reset role;

-- m2 を期限切れの時刻にする(status は pending のまま。期限切れにする定期処理が動く前の状態)
select set_config('request.jwt.claims', '', true);
update public.sessions set expires_at = now() - interval '1 hour' where concern = 'm2';

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000fd","role":"authenticated"}', true);

-- 63. 期限切れの pending しか無ければ、また申し込める(m3)
select lives_ok(
  $$ insert into public.sessions (applicant_id, recipient_id, consultant_id, teller_id, initiated_by, concern)
     values ('00000000-0000-0000-0000-0000000000fd', '00000000-0000-0000-0000-0000000000fe',
             '00000000-0000-0000-0000-0000000000fd', '00000000-0000-0000-0000-0000000000fe', 'consultant', 'm3') $$,
  '期限切れの承認待ちしか無ければ、また申し込める'
);
reset role;

-- nao が m3 を拒否する
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000fe","role":"authenticated"}', true);
update public.sessions set status = 'rejected' where concern = 'm3';
reset role;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000fd","role":"authenticated"}', true);

-- 64. 拒否された後なら、また申し込める
select lives_ok(
  $$ insert into public.sessions (applicant_id, recipient_id, consultant_id, teller_id, initiated_by, concern)
     values ('00000000-0000-0000-0000-0000000000fd', '00000000-0000-0000-0000-0000000000fe',
             '00000000-0000-0000-0000-0000000000fd', '00000000-0000-0000-0000-0000000000fe', 'consultant', 'm4') $$,
  '拒否されたセッションしか無ければ、また申し込める'
);
reset role;

-- 66. 逆向き: 占い師から応募した pending があれば、相談者から同じ占い師に申し込めない
-- olga=相談者。nao が olga の投稿 p5 に応募した pending を作る
select set_config('request.jwt.claims', '', true);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000ff', 'olga@example.com');

insert into public.consultation_posts (id, consultant_id, concern) values
  ('00000000-0000-0000-0000-000000000a05', '00000000-0000-0000-0000-0000000000ff', 'olgaの悩み');

insert into public.sessions
  (applicant_id, recipient_id, consultant_id, teller_id, initiated_by, post_id)
values
  ('00000000-0000-0000-0000-0000000000fe', '00000000-0000-0000-0000-0000000000ff',
   '00000000-0000-0000-0000-0000000000ff', '00000000-0000-0000-0000-0000000000fe', 'teller',
   '00000000-0000-0000-0000-000000000a05');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000ff","role":"authenticated"}', true);

select throws_ok(
  $$ insert into public.sessions (applicant_id, recipient_id, consultant_id, teller_id, initiated_by, concern)
     values ('00000000-0000-0000-0000-0000000000ff', '00000000-0000-0000-0000-0000000000fe',
             '00000000-0000-0000-0000-0000000000ff', '00000000-0000-0000-0000-0000000000fe', 'consultant', 'x') $$,
  'P0001', 'an open session already exists between the consultant and the teller',
  '占い師から応募された承認待ちがあれば、相談者からも同じ占い師に申し込めない'
);
reset role;

-- 67. システムが終了済みの行を直接作るときは、申込みではないので確かめない
-- (mika → nao は 64 の pending があり二重、carol → hana は受付停止中)
select set_config('request.jwt.claims', '', true);
select lives_ok(
  $$ insert into public.sessions (applicant_id, recipient_id, consultant_id, teller_id, initiated_by, concern, status)
     values ('00000000-0000-0000-0000-0000000000fd', '00000000-0000-0000-0000-0000000000fe',
             '00000000-0000-0000-0000-0000000000fd', '00000000-0000-0000-0000-0000000000fe', 'consultant', 'x', 'completed'),
            ('00000000-0000-0000-0000-0000000000f3', '00000000-0000-0000-0000-0000000000f8',
             '00000000-0000-0000-0000-0000000000f3', '00000000-0000-0000-0000-0000000000f8', 'consultant', 'x', 'completed') $$,
  'システムが終了済みの行を作るときは、二重申込み・受付停止中でも登録できる'
);

-- 65. 申込みのチェック関数はトリガー専用で、API から呼べない
select is(
  has_function_privilege('authenticated', 'public.check_session_request()', 'execute'),
  false, 'authenticated は check_session_request を実行できない'
);

-- ===== 完了セッション数(teller_profiles.session_count)=====
-- 上の流れに影響されないよう、専用の占い師 dave(f4)と carol(相談者)のセッションで確かめる
select set_config('request.jwt.claims', '', true);

-- 45-46. 集計関数はトリガー専用で、API から呼べない
select is(
  has_function_privilege('anon', 'public.update_teller_session_count()', 'execute'),
  false, 'anon は update_teller_session_count を実行できない'
);
select is(
  has_function_privilege('authenticated', 'public.update_teller_session_count()', 'execute'),
  false, 'authenticated は update_teller_session_count を実行できない'
);

-- x1=completed / x2=auto_completed / x3=active / x4=rejected / x5=expired(いずれも carol → dave)
-- x6=pending(alice → dave。carol → dave の active と重ならないよう相談者を変える)
insert into public.sessions
  (id, applicant_id, recipient_id, consultant_id, teller_id, initiated_by, concern, status)
select v.id, v.consultant, '00000000-0000-0000-0000-0000000000f4',
       v.consultant, '00000000-0000-0000-0000-0000000000f4', 'consultant', 'x', v.status
  from (values
    ('00000000-0000-0000-0000-000000000601'::uuid, '00000000-0000-0000-0000-0000000000f3'::uuid, 'completed'),
    ('00000000-0000-0000-0000-000000000602'::uuid, '00000000-0000-0000-0000-0000000000f3'::uuid, 'auto_completed'),
    ('00000000-0000-0000-0000-000000000603'::uuid, '00000000-0000-0000-0000-0000000000f3'::uuid, 'active'),
    ('00000000-0000-0000-0000-000000000604'::uuid, '00000000-0000-0000-0000-0000000000f3'::uuid, 'rejected'),
    ('00000000-0000-0000-0000-000000000605'::uuid, '00000000-0000-0000-0000-0000000000f3'::uuid, 'expired'),
    ('00000000-0000-0000-0000-000000000606'::uuid, '00000000-0000-0000-0000-0000000000f1'::uuid, 'pending')
  ) as v (id, consultant, status);

-- 47. completed と auto_completed だけを数える
select is(
  (select session_count from public.teller_profiles where profile_id = '00000000-0000-0000-0000-0000000000f4'),
  2, 'session_count は completed / auto_completed のセッションだけを数える'
);

-- 48. 相談者が完了すると増える
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000f3","role":"authenticated"}', true);
update public.sessions set status = 'completed' where id = '00000000-0000-0000-0000-000000000603';
reset role;
select set_config('request.jwt.claims', '', true);

select is(
  (select session_count from public.teller_profiles where profile_id = '00000000-0000-0000-0000-0000000000f4'),
  3, '相談者が完了操作をすると session_count が増える'
);

-- 49. 完了したセッションが消えると減る(ユーザー削除の連鎖などに備える)
delete from public.sessions where id = '00000000-0000-0000-0000-000000000601';

select is(
  (select session_count from public.teller_profiles where profile_id = '00000000-0000-0000-0000-0000000000f4'),
  2, '完了したセッションが削除されると session_count が減る'
);

select * from finish();
rollback;
