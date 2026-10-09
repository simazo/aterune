begin;
select plan(40);

-- ===== テストデータ(postgres 権限) =====
-- alice=占い師でもある相談者 / bob=占い師 / carol=占い師ではない一般ユーザー
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000f1', 'alice@example.com'),
  ('00000000-0000-0000-0000-0000000000f2', 'bob@example.com'),
  ('00000000-0000-0000-0000-0000000000f3', 'carol@example.com');

insert into public.teller_profiles (profile_id) values
  ('00000000-0000-0000-0000-0000000000f1'),
  ('00000000-0000-0000-0000-0000000000f2');

-- alice の掲示板投稿(p1=open、p2=closed)
insert into public.consultation_posts (id, consultant_id, category, concern, status) values
  ('00000000-0000-0000-0000-000000000a01', '00000000-0000-0000-0000-0000000000f1', '恋愛', 'aliceの悩み', 'open'),
  ('00000000-0000-0000-0000-000000000a02', '00000000-0000-0000-0000-0000000000f1', '仕事', '閉じた悩み',   'closed');

-- s1,s2: carol → bob の申込み(pending)/ s3: 進行中(active)/ s4: 期限切れの pending
insert into public.sessions
  (id, applicant_id, recipient_id, consultant_id, teller_id, initiated_by, concern, status, expires_at)
values
  ('00000000-0000-0000-0000-000000000501', '00000000-0000-0000-0000-0000000000f3', '00000000-0000-0000-0000-0000000000f2',
   '00000000-0000-0000-0000-0000000000f3', '00000000-0000-0000-0000-0000000000f2', 'consultant', 's1', 'pending', default),
  ('00000000-0000-0000-0000-000000000502', '00000000-0000-0000-0000-0000000000f3', '00000000-0000-0000-0000-0000000000f2',
   '00000000-0000-0000-0000-0000000000f3', '00000000-0000-0000-0000-0000000000f2', 'consultant', 's2', 'pending', default),
  ('00000000-0000-0000-0000-000000000503', '00000000-0000-0000-0000-0000000000f3', '00000000-0000-0000-0000-0000000000f2',
   '00000000-0000-0000-0000-0000000000f3', '00000000-0000-0000-0000-0000000000f2', 'consultant', 's3', 'active', default),
  ('00000000-0000-0000-0000-000000000504', '00000000-0000-0000-0000-0000000000f3', '00000000-0000-0000-0000-0000000000f2',
   '00000000-0000-0000-0000-0000000000f3', '00000000-0000-0000-0000-0000000000f2', 'consultant', 's4', 'pending', now() - interval '1 hour');

-- s5: bob が alice の投稿 p1 に応募(concern は投稿からコピーされる)
insert into public.sessions
  (id, applicant_id, recipient_id, consultant_id, teller_id, initiated_by, post_id)
values
  ('00000000-0000-0000-0000-000000000505', '00000000-0000-0000-0000-0000000000f2', '00000000-0000-0000-0000-0000000000f1',
   '00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000f2', 'teller',
   '00000000-0000-0000-0000-000000000a01');

-- 1. RLS が有効
select ok(
  (select relrowsecurity from pg_class where oid = 'public.sessions'::regclass),
  'sessions: RLS が有効'
);

-- 2. updated_at トリガー(トリガー名は既存の命名に合わせる)
select has_trigger('public', 'sessions', 'set_updated_at', 'sessions: updated_at トリガーがある');

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
     values ('00000000-0000-0000-0000-0000000000f3', '00000000-0000-0000-0000-0000000000f2',
             '00000000-0000-0000-0000-0000000000f3', '00000000-0000-0000-0000-0000000000f2', 'consultant', 'carolの新規申込') $$,
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
select throws_ok(
  $$ insert into public.sessions (applicant_id, recipient_id, consultant_id, teller_id, initiated_by, concern)
     values ('00000000-0000-0000-0000-0000000000f3', '00000000-0000-0000-0000-0000000000f2',
             '00000000-0000-0000-0000-0000000000f3', '00000000-0000-0000-0000-0000000000f2', 'teller', 'x') $$,
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
     values ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000f2',
             '00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000f2', 'consultant', '占い師aliceの相談') $$,
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

-- 22. 占い師は完了操作できない(相談者のみ)
select throws_ok(
  $$ update public.sessions set status = 'completed' where id = '00000000-0000-0000-0000-000000000503' $$,
  'P0001', null, '占い師側は active → completed にできない'
);

-- 23. closed の投稿には応募できない
select throws_ok(
  $$ insert into public.sessions (applicant_id, recipient_id, consultant_id, teller_id, initiated_by, post_id)
     values ('00000000-0000-0000-0000-0000000000f2', '00000000-0000-0000-0000-0000000000f1',
             '00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000f2', 'teller',
             '00000000-0000-0000-0000-000000000a02') $$,
  'P0001', null, 'closed の投稿には応募できない'
);

-- 24. 応募先が投稿者でなければ作れない
select throws_ok(
  $$ insert into public.sessions (applicant_id, recipient_id, consultant_id, teller_id, initiated_by, post_id)
     values ('00000000-0000-0000-0000-0000000000f2', '00000000-0000-0000-0000-0000000000f3',
             '00000000-0000-0000-0000-0000000000f3', '00000000-0000-0000-0000-0000000000f2', 'teller',
             '00000000-0000-0000-0000-000000000a01') $$,
  'P0001', null, 'recipient が投稿者でなければ作れない'
);

-- 25. 期限切れの pending は承認できない
select throws_ok(
  $$ update public.sessions set status = 'active' where id = '00000000-0000-0000-0000-000000000504' $$,
  'P0001', null, '期限切れの pending は承認できない'
);

-- 26. 占い師は open の投稿に応募できる
select lives_ok(
  $$ insert into public.sessions (applicant_id, recipient_id, consultant_id, teller_id, initiated_by, post_id)
     values ('00000000-0000-0000-0000-0000000000f2', '00000000-0000-0000-0000-0000000000f1',
             '00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000f2', 'teller',
             '00000000-0000-0000-0000-000000000a01') $$,
  '占い師は open の投稿に応募できる'
);
reset role;

-- ===== carol(相談者)が完了操作 =====
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000f3","role":"authenticated"}', true);

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

-- ===== 制約(postgres 権限)=====
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

select * from finish();
rollback;