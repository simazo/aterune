begin;
select plan(20);

-- ===== テストデータ(postgres 権限) =====
-- carol=相談者 / bob=占い師 / dave=無関係のユーザー
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000c1', 'carol@example.com'),
  ('00000000-0000-0000-0000-0000000000b2', 'bob@example.com'),
  ('00000000-0000-0000-0000-0000000000d3', 'dave@example.com');

insert into public.teller_profiles (profile_id) values
  ('00000000-0000-0000-0000-0000000000b2');

-- s1: carol(相談者)と bob(占い師)のセッション
insert into public.sessions
  (id, applicant_id, recipient_id, consultant_id, teller_id, initiated_by, concern)
values
  ('00000000-0000-0000-0000-000000000901', '00000000-0000-0000-0000-0000000000c1',
   '00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-0000000000c1',
   '00000000-0000-0000-0000-0000000000b2', 'consultant', 's1');

-- 1. RLS が有効
select ok(
  (select relrowsecurity from pg_class where oid = 'public.reports'::regclass),
  'reports: RLS が有効'
);

-- ===== anon =====
set local role anon;

-- 2. 未ログインでは通報できない
select throws_ok(
  $$ insert into public.reports (reporter_id, reported_user_id, reason) values
     ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000b2', 'spam') $$,
  '42501', null,
  'anon は reports を insert できない'
);
reset role;

-- ===== authenticated(carol) =====
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}', true);

-- 3. セッションなしで通報できる(占い師詳細から)
select lives_ok(
  $$ insert into public.reports (reporter_id, reported_user_id, reason, detail) values
     ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000b2',
      'harassment', '詳しい内容') $$,
  '自分名義で、セッションなしの通報を insert できる'
);

-- 4. セッションの相手を、そのセッションの ID 付きで通報できる(セッション詳細から)
select lives_ok(
  $$ insert into public.reports (reporter_id, reported_user_id, session_id, reason) values
     ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000b2',
      '00000000-0000-0000-0000-000000000901', 'spam') $$,
  'セッションの相手を、そのセッションの ID 付きで通報できる'
);

-- 5. 同じ相手を何度でも通報できる
select lives_ok(
  $$ insert into public.reports (reporter_id, reported_user_id, reason) values
     ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000b2', 'other') $$,
  '同じ相手を続けて通報できる'
);

-- 6. 他人名義では通報できない
select throws_ok(
  $$ insert into public.reports (reporter_id, reported_user_id, reason) values
     ('00000000-0000-0000-0000-0000000000d3', '00000000-0000-0000-0000-0000000000b2', 'spam') $$,
  '42501', null,
  '他人を reporter_id にした insert はできない'
);

-- 7. 自分自身は通報できない
select throws_ok(
  $$ insert into public.reports (reporter_id, reported_user_id, reason) values
     ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000c1', 'spam') $$,
  '23514', null,
  '自分自身は通報できない'
);

-- 8. セッションの相手でない人を、そのセッションで通報できない
select throws_ok(
  $$ insert into public.reports (reporter_id, reported_user_id, session_id, reason) values
     ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000d3',
      '00000000-0000-0000-0000-000000000901', 'spam') $$,
  'P0001', 'the reported user is not the other party of the session',
  'セッションの相手でない人を、そのセッションで通報できない'
);

-- 9. 存在しないセッションの ID は付けられない
select throws_ok(
  $$ insert into public.reports (reporter_id, reported_user_id, session_id, reason) values
     ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000b2',
      '00000000-0000-0000-0000-000000000999', 'spam') $$,
  'P0001', 'the reporter is not a party of the session',
  '存在しないセッションの ID は付けられない'
);

-- 10. 決めた値でない理由は入れられない
select throws_ok(
  $$ insert into public.reports (reporter_id, reported_user_id, reason) values
     ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000b2', 'unknown') $$,
  '22P02', null,
  '決めた値でない reason は入れられない'
);

-- 11. 詳しい内容は500文字まで入れられる
select lives_ok(
  $$ insert into public.reports (reporter_id, reported_user_id, reason, detail) values
     ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000b2',
      'other', repeat('あ', 500)) $$,
  'detail は500文字なら入れられる'
);

-- 12. 詳しい内容は501文字にできない
select throws_ok(
  $$ insert into public.reports (reporter_id, reported_user_id, reason, detail) values
     ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000b2',
      'other', repeat('あ', 501)) $$,
  '23514', null,
  'detail は501文字にできない'
);

-- 13. 自分が出した通報も読めない
select throws_ok(
  $$ select * from public.reports $$,
  '42501', null,
  '通報した本人も reports を select できない'
);

-- 14. update できない
select throws_ok(
  $$ update public.reports set reason = 'spam' $$,
  '42501', null,
  'authenticated は reports を update できない'
);

-- 15. delete できない
select throws_ok(
  $$ delete from public.reports $$,
  '42501', null,
  'authenticated は reports を delete できない'
);

-- ===== authenticated(bob。s1 の占い師) =====
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000b2","role":"authenticated"}', true);

-- 16. 占い師の側からも、セッションの相手(相談者)を通報できる
select lives_ok(
  $$ insert into public.reports (reporter_id, reported_user_id, session_id, reason) values
     ('00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-0000000000c1',
      '00000000-0000-0000-0000-000000000901', 'impersonation') $$,
  '占い師の側からも、セッションの相手を通報できる'
);

-- 17. 通報された人も読めない
select throws_ok(
  $$ select * from public.reports $$,
  '42501', null,
  '通報された人も reports を select できない'
);

-- ===== authenticated(dave。s1 の当事者でない) =====
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000d3","role":"authenticated"}', true);

-- 18. 当事者でないセッションの ID は付けられない
select throws_ok(
  $$ insert into public.reports (reporter_id, reported_user_id, session_id, reason) values
     ('00000000-0000-0000-0000-0000000000d3', '00000000-0000-0000-0000-0000000000b2',
      '00000000-0000-0000-0000-000000000901', 'spam') $$,
  'P0001', 'the reporter is not a party of the session',
  '当事者でないセッションの ID は付けられない'
);
reset role;

-- 19. 通報は入っている(postgres 権限で数える。3〜5・11・16 の5件)
select is(
  (select count(*)::int from public.reports),
  5,
  '通報できた分だけ reports に入っている'
);

-- 20. セッションが消えても通報は残り、session_id だけが空になる
delete from public.sessions where id = '00000000-0000-0000-0000-000000000901';
select is(
  (select count(*)::int from public.reports where session_id is null),
  5,
  'セッションが消えても通報は残り、session_id が空になる'
);

select * from finish();
rollback;
