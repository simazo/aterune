begin;
select plan(20);

-- ===== テストデータ(postgres 権限)=====
-- carol=相談者 / bob,erin,fay,gus=占い師 / dave=無関係のユーザー
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000c1', 'carol@example.com'),
  ('00000000-0000-0000-0000-0000000000b2', 'bob@example.com'),
  ('00000000-0000-0000-0000-0000000000d3', 'dave@example.com'),
  ('00000000-0000-0000-0000-0000000000e4', 'erin@example.com'),
  ('00000000-0000-0000-0000-0000000000f5', 'fay@example.com'),
  ('00000000-0000-0000-0000-0000000000a6', 'gus@example.com');

insert into public.teller_profiles (profile_id) values
  ('00000000-0000-0000-0000-0000000000b2'),
  ('00000000-0000-0000-0000-0000000000e4'),
  ('00000000-0000-0000-0000-0000000000f5'),
  ('00000000-0000-0000-0000-0000000000a6');

insert into public.profile_private_details (profile_id, birthdate, gender) values
  ('00000000-0000-0000-0000-0000000000c1', '1990-01-01', 'female'),
  ('00000000-0000-0000-0000-0000000000b2', '1985-05-05', 'male');

-- carol(相談者)との関係:
--   bob : carol が申し込んだ pending           → 見える
--   erin: erin(占い師)が応募した pending       → 見えない
--   fay : carol が申し込んだが rejected        → 見えない
--   gus : carol が申し込んだ active            → 見える
insert into public.sessions
  (applicant_id, recipient_id, consultant_id, teller_id, initiated_by, concern, status)
select applicant, recipient, '00000000-0000-0000-0000-0000000000c1', teller, initiated_by, 'x', status
from (values
  ('00000000-0000-0000-0000-0000000000c1'::uuid, '00000000-0000-0000-0000-0000000000b2'::uuid, '00000000-0000-0000-0000-0000000000b2'::uuid, 'consultant', 'pending'),
  ('00000000-0000-0000-0000-0000000000e4'::uuid, '00000000-0000-0000-0000-0000000000c1'::uuid, '00000000-0000-0000-0000-0000000000e4'::uuid, 'teller',     'pending'),
  ('00000000-0000-0000-0000-0000000000c1'::uuid, '00000000-0000-0000-0000-0000000000f5'::uuid, '00000000-0000-0000-0000-0000000000f5'::uuid, 'consultant', 'rejected'),
  ('00000000-0000-0000-0000-0000000000c1'::uuid, '00000000-0000-0000-0000-0000000000a6'::uuid, '00000000-0000-0000-0000-0000000000a6'::uuid, 'consultant', 'active')
) as v(applicant, recipient, teller, initiated_by, status);

-- 1. RLS が有効
select ok(
  (select relrowsecurity from pg_class where oid = 'public.profile_private_details'::regclass),
  'profile_private_details: RLS が有効'
);

-- 2. updated_at トリガー(名前は既存の命名に合わせる)
select has_trigger('public', 'profile_private_details', 'set_updated_at',
  'profile_private_details: updated_at トリガーがある');

-- ===== anon =====
set local role anon;

-- 3. anon は select できない
select throws_ok($$ select * from public.profile_private_details $$, '42501', null,
  'anon は profile_private_details を select できない');

-- 4. anon は insert できない
select throws_ok(
  $$ insert into public.profile_private_details (profile_id, birthdate) values
     ('00000000-0000-0000-0000-0000000000d3', '1995-03-03') $$,
  '42501', null, 'anon は profile_private_details を insert できない'
);
reset role;

-- ===== carol(本人)=====
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}', true);

-- 5. 自分の行は見える
select is(
  (select count(*)::int from public.profile_private_details where profile_id = '00000000-0000-0000-0000-0000000000c1'),
  1, '本人は自分の行を select できる'
);

-- 6. 相談者から占い師の情報は見えない(相手が bob で、セッションがあっても)
select is(
  (select count(*)::int from public.profile_private_details where profile_id = '00000000-0000-0000-0000-0000000000b2'),
  0, '相談者は、セッション相手の占い師の情報を select できない'
);

-- 7. 自分の行を更新できる
select lives_ok(
  $$ update public.profile_private_details set birthdate = '1990-02-02'
     where profile_id = '00000000-0000-0000-0000-0000000000c1' $$,
  '本人は自分の行を update できる'
);

-- 8. profile_id は変更できない(列 GRANT)
select throws_ok(
  $$ update public.profile_private_details
     set profile_id = '00000000-0000-0000-0000-0000000000d3'
     where profile_id = '00000000-0000-0000-0000-0000000000c1' $$,
  '42501', null, 'profile_id は update できない'
);

-- 9. 他人の profile_id では insert できない
select throws_ok(
  $$ insert into public.profile_private_details (profile_id, birthdate) values
     ('00000000-0000-0000-0000-0000000000d3', '1995-03-03') $$,
  '42501', null, '他人名義では insert できない'
);

-- 10. delete できない
select throws_ok($$ delete from public.profile_private_details $$, '42501', null,
  'authenticated は profile_private_details を delete できない');
reset role;

-- ===== 占い師から見えるか =====
-- 11. bob: 相談者が申し込んだ pending → 見える
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b2","role":"authenticated"}', true);
select is(
  (select count(*)::int from public.profile_private_details where profile_id = '00000000-0000-0000-0000-0000000000c1'),
  1, '相談者が申し込んだ pending なら、占い師は相談者の情報を見られる'
);
reset role;

-- 12. erin: 占い師から応募した pending → 見えない
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000e4","role":"authenticated"}', true);
select is(
  (select count(*)::int from public.profile_private_details where profile_id = '00000000-0000-0000-0000-0000000000c1'),
  0, '占い師から応募した pending では、相談者の情報は見られない'
);
reset role;

-- 13. fay: rejected → 見えない
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000f5","role":"authenticated"}', true);
select is(
  (select count(*)::int from public.profile_private_details where profile_id = '00000000-0000-0000-0000-0000000000c1'),
  0, 'rejected のセッションでは、相談者の情報は見られない'
);
reset role;

-- 14. gus: active → 見える
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a6","role":"authenticated"}', true);
select is(
  (select count(*)::int from public.profile_private_details where profile_id = '00000000-0000-0000-0000-0000000000c1'),
  1, 'active なら、占い師は相談者の情報を見られる'
);

-- gus は見えているだけで、更新はできない(0 行に影響して黙って成功する)
update public.profile_private_details set gender = 'hacked'
  where profile_id = '00000000-0000-0000-0000-0000000000c1';
reset role;

-- 15. 見えていても他人の行は書き換えられない
select is(
  (select gender from public.profile_private_details where profile_id = '00000000-0000-0000-0000-0000000000c1'),
  'female', '見える相手の行でも update できない'
);

-- ===== dave(関係なし)=====
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000d3","role":"authenticated"}', true);

-- 16. セッションが無ければ見えない
select is(
  (select count(*)::int from public.profile_private_details where profile_id = '00000000-0000-0000-0000-0000000000c1'),
  0, 'セッションの無い人には見えない'
);

-- 17. 自分の行は insert できる
select lives_ok(
  $$ insert into public.profile_private_details (profile_id, birthdate, gender) values
     ('00000000-0000-0000-0000-0000000000d3', '1995-03-03', 'other') $$,
  '本人は自分の行を insert できる'
);

-- 18. 同じ profile_id は2行作れない
select throws_ok(
  $$ insert into public.profile_private_details (profile_id) values
     ('00000000-0000-0000-0000-0000000000d3') $$,
  '23505', null, 'profile_id は重複できない(1ユーザー1行)'
);
reset role;

-- ===== 制約(postgres 権限)=====
-- 19. 存在しない profile_id は外部キー違反
select throws_ok(
  $$ insert into public.profile_private_details (profile_id) values (gen_random_uuid()) $$,
  '23503', null, '存在しない profile_id は外部キー違反'
);

-- 20. profiles を消すと連鎖削除される
delete from public.profiles where id = '00000000-0000-0000-0000-0000000000c1';
select is(
  (select count(*)::int from public.profile_private_details where profile_id = '00000000-0000-0000-0000-0000000000c1'),
  0, 'profiles を削除すると profile_private_details も連鎖削除される'
);

select * from finish();
rollback;