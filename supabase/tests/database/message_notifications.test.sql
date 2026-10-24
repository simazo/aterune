begin;
select plan(6);

-- ===== テストデータ(postgres 権限)=====
-- carol=相談者 / bob=占い師
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000c1', 'carol@example.com'),
  ('00000000-0000-0000-0000-0000000000b2', 'bob@example.com');

insert into public.teller_profiles (profile_id) values
  ('00000000-0000-0000-0000-0000000000b2');

-- s1=active(carol → bob)
insert into public.sessions
  (id, applicant_id, recipient_id, consultant_id, teller_id, initiated_by, concern, status)
values
  ('00000000-0000-0000-0000-000000000601', '00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000b2',
   '00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000b2', 'consultant', 's1', 'active');

-- 申込みの通知など、メッセージ以外の通知は数えない
delete from public.notifications where session_id = '00000000-0000-0000-0000-000000000601';

-- ===== 相談者が送る =====
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}', true);
insert into public.messages (session_id, sender_id, content) values
  ('00000000-0000-0000-0000-000000000601', '00000000-0000-0000-0000-0000000000c1', 'carolのメッセージ');
reset role;

-- 1. 相手(占い師)に message_received が届く
select is(
  (select count(*)::int from public.notifications
    where session_id = '00000000-0000-0000-0000-000000000601'
      and recipient_id = '00000000-0000-0000-0000-0000000000b2'
      and type = 'message_received'),
  1, '相談者のメッセージで、占い師に message_received が届く'
);

-- 2. 送った本人には届かない
select is(
  (select count(*)::int from public.notifications
    where session_id = '00000000-0000-0000-0000-000000000601'
      and recipient_id = '00000000-0000-0000-0000-0000000000c1'),
  0, '送った本人(相談者)には届かない'
);

-- ===== 占い師が送る =====
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b2","role":"authenticated"}', true);
insert into public.messages (session_id, sender_id, content) values
  ('00000000-0000-0000-0000-000000000601', '00000000-0000-0000-0000-0000000000b2', 'bobのメッセージ');
reset role;

-- 3. 相手(相談者)に message_received が届く
select is(
  (select count(*)::int from public.notifications
    where session_id = '00000000-0000-0000-0000-000000000601'
      and recipient_id = '00000000-0000-0000-0000-0000000000c1'
      and type = 'message_received'),
  1, '占い師のメッセージで、相談者に message_received が届く'
);

-- 4. 1通につき1件だけ(2通で合計2件)
select is(
  (select count(*)::int from public.notifications where session_id = '00000000-0000-0000-0000-000000000601'),
  2, '1通につき通知は1件だけ'
);

-- 5. 通知の type に message_received を入れられる(制約)
select lives_ok(
  $$ insert into public.notifications (recipient_id, type, session_id) values
     ('00000000-0000-0000-0000-0000000000c1', 'message_received', '00000000-0000-0000-0000-000000000601') $$,
  'notifications.type に message_received を入れられる'
);

-- ===== 関数の実行権限 =====
-- 6. authenticated は通知トリガー関数を直接呼べない
select is(
  has_function_privilege('authenticated', 'public.notify_message_received()', 'execute'),
  false, 'authenticated は notify_message_received を実行できない'
);

select * from finish();
rollback;
