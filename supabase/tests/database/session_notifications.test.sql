begin;
select plan(14);

-- ===== テストデータ(postgres 権限)=====
-- carol=相談者 / bob,erin=占い師
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000c1', 'carol@example.com'),
  ('00000000-0000-0000-0000-0000000000b2', 'bob@example.com'),
  ('00000000-0000-0000-0000-0000000000e4', 'erin@example.com');

insert into public.teller_profiles (profile_id) values
  ('00000000-0000-0000-0000-0000000000b2'),
  ('00000000-0000-0000-0000-0000000000e4');

-- s1: carol → bob(相談者から申込み)/ s2: 同上(拒否される)/ s3: 同上(期限切れ)
-- se: erin(占い師)→ carol の投稿へ応募(占い師から)
insert into public.sessions
  (id, applicant_id, recipient_id, consultant_id, teller_id, initiated_by, concern)
values
  ('00000000-0000-0000-0000-0000000009a1', '00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000b2',
   '00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000b2', 'consultant', 's1'),
  ('00000000-0000-0000-0000-0000000009a2', '00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000b2',
   '00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000b2', 'consultant', 's2'),
  ('00000000-0000-0000-0000-0000000009a3', '00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000b2',
   '00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000b2', 'consultant', 's3'),
  ('00000000-0000-0000-0000-0000000009e1', '00000000-0000-0000-0000-0000000000e4', '00000000-0000-0000-0000-0000000000c1',
   '00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000e4', 'teller', 'se');

-- 1. 申込みが作られると、申込まれた側(bob)に通知が行く
select is(
  (select count(*)::int from public.notifications
    where session_id = '00000000-0000-0000-0000-0000000009a1'
      and recipient_id = '00000000-0000-0000-0000-0000000000b2'
      and type = 'session_request_received'),
  1, '申込みで、申込まれた側に session_request_received が届く'
);

-- 2. 申込んだ側(carol)には届かない
select is(
  (select count(*)::int from public.notifications
    where session_id = '00000000-0000-0000-0000-0000000009a1'
      and recipient_id = '00000000-0000-0000-0000-0000000000c1'),
  0, '申込んだ側には申込み通知が届かない'
);

-- 3. 占い師からの応募でも、申込まれた側(carol)に届く
select is(
  (select count(*)::int from public.notifications
    where session_id = '00000000-0000-0000-0000-0000000009e1'
      and recipient_id = '00000000-0000-0000-0000-0000000000c1'
      and type = 'session_request_received'),
  1, '占い師からの応募でも、申込まれた側(相談者)に届く'
);

-- ===== 承認 =====
update public.sessions set status = 'active' where id = '00000000-0000-0000-0000-0000000009a1';
update public.sessions set status = 'active' where id = '00000000-0000-0000-0000-0000000009e1';

-- 4. 承認されると、申込んだ側(carol)に通知
select is(
  (select count(*)::int from public.notifications
    where session_id = '00000000-0000-0000-0000-0000000009a1'
      and recipient_id = '00000000-0000-0000-0000-0000000000c1'
      and type = 'session_request_approved'),
  1, '承認で、申込んだ側に session_request_approved が届く'
);

-- 6. 占い師から応募した場合は、申込んだ側(erin)に届く
select is(
  (select count(*)::int from public.notifications
    where session_id = '00000000-0000-0000-0000-0000000009e1'
      and recipient_id = '00000000-0000-0000-0000-0000000000e4'
      and type = 'session_request_approved'),
  1, '占い師から応募した場合も、申込んだ側(占い師)に承認通知が届く'
);

-- ===== 拒否 =====
update public.sessions set status = 'rejected' where id = '00000000-0000-0000-0000-0000000009a2';

-- 5. 拒否されると、申込んだ側に通知
select is(
  (select count(*)::int from public.notifications
    where session_id = '00000000-0000-0000-0000-0000000009a2'
      and recipient_id = '00000000-0000-0000-0000-0000000000c1'
      and type = 'session_request_rejected'),
  1, '拒否で、申込んだ側に session_request_rejected が届く'
);

-- ===== 完了 =====
update public.sessions set status = 'completed' where id = '00000000-0000-0000-0000-0000000009a1';

-- 7. 占い師に session_completed
select is(
  (select count(*)::int from public.notifications
    where session_id = '00000000-0000-0000-0000-0000000009a1'
      and recipient_id = '00000000-0000-0000-0000-0000000000b2'
      and type = 'session_completed'),
  1, '完了で、占い師に session_completed が届く'
);

-- 8. 相談者に review_request
select is(
  (select count(*)::int from public.notifications
    where session_id = '00000000-0000-0000-0000-0000000009a1'
      and recipient_id = '00000000-0000-0000-0000-0000000000c1'
      and type = 'review_request'),
  1, '完了で、相談者に review_request が届く'
);

-- 9. s1 の通知は合計4件(申込み・承認・完了・評価依頼)
select is(
  (select count(*)::int from public.notifications where session_id = '00000000-0000-0000-0000-0000000009a1'),
  4, 's1 の通知は4件で、余計な通知が無い'
);

-- 12. status 以外の更新では通知が増えない
update public.sessions set concern = '更新' where id = '00000000-0000-0000-0000-0000000009a1';
select is(
  (select count(*)::int from public.notifications where session_id = '00000000-0000-0000-0000-0000000009a1'),
  4, 'status 以外の更新では通知が増えない'
);

-- ===== 自動完了 =====
update public.sessions set status = 'auto_completed' where id = '00000000-0000-0000-0000-0000000009e1';

-- 10. 相談者・占い師の両方に session_auto_completed
select is(
  (select count(*)::int from public.notifications
    where session_id = '00000000-0000-0000-0000-0000000009e1'
      and type = 'session_auto_completed'
      and recipient_id in ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000e4')),
  2, '自動完了で、相談者と占い師の両方に届く'
);

-- ===== 期限切れ =====
update public.sessions set status = 'expired' where id = '00000000-0000-0000-0000-0000000009a3';

-- 11. 期限切れでは通知しない(申込み通知の1件のみ)
select is(
  (select count(*)::int from public.notifications where session_id = '00000000-0000-0000-0000-0000000009a3'),
  1, '期限切れでは通知が増えない'
);

-- ===== 関数の実行権限 =====
-- 13. authenticated は通知トリガー関数を直接呼べない
select is(
  has_function_privilege('authenticated', 'public.notify_session_request_received()', 'execute'),
  false, 'authenticated は notify_session_request_received を実行できない'
);

-- 14. 同上
select is(
  has_function_privilege('authenticated', 'public.notify_session_status_change()', 'execute'),
  false, 'authenticated は notify_session_status_change を実行できない'
);

select * from finish();
rollback;