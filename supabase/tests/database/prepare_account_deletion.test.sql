begin;
select plan(15);

-- ===== テストデータ(postgres 権限) =====
-- alice=退会する人(占い師でもある)/ bob=占い師(alice が申し込んだ相手)/ carol=alice に申し込んだ相談者
-- dave=占い師(alice との完了済みのセッション・メッセージ・レビューあり)/ erin=占い師(alice との進行中のセッション)
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000b1', 'alice@example.com'),
  ('00000000-0000-0000-0000-0000000000b2', 'bob@example.com'),
  ('00000000-0000-0000-0000-0000000000b3', 'carol@example.com'),
  ('00000000-0000-0000-0000-0000000000b4', 'dave@example.com'),
  ('00000000-0000-0000-0000-0000000000b5', 'erin@example.com');

update public.profiles
   set display_name = 'アリス', bio = 'よろしくお願いします', avatar_path = '00000000-0000-0000-0000-0000000000b1/1730000000000.jpg'
 where id = '00000000-0000-0000-0000-0000000000b1';

insert into public.teller_profiles (profile_id) values
  ('00000000-0000-0000-0000-0000000000b1'),
  ('00000000-0000-0000-0000-0000000000b2'),
  ('00000000-0000-0000-0000-0000000000b4'),
  ('00000000-0000-0000-0000-0000000000b5');

insert into public.profile_private_details (profile_id, birthdate, gender) values
  ('00000000-0000-0000-0000-0000000000b1', '1995-04-12', 'female');

insert into public.push_tokens (user_id, expo_push_token) values
  ('00000000-0000-0000-0000-0000000000b1', 'ExponentPushToken[alice]'),
  ('00000000-0000-0000-0000-0000000000b2', 'ExponentPushToken[bob]');

-- seed に依存しないよう、テスト用の悩みタグを作る
insert into public.tags (id, category, slug, name) values
  ('00000000-0000-0000-0000-0000000000e1', 'concern', 'test-concern-a', 'テスト悩みA');

-- alice のお悩み投稿(p1=open、p2=closed)
insert into public.consultation_posts (id, consultant_id, concern_tag_id, concern, status) values
  ('00000000-0000-0000-0000-000000000a01', '00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000e1', '募集中の悩み', 'open'),
  ('00000000-0000-0000-0000-000000000a02', '00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000e1', '閉じた悩み',   'closed');

-- s1: alice → bob(pending、alice が申し込んだ)/ s2: carol → alice(pending、alice が申し込まれた)
-- s3: alice → dave(completed)/ s4: alice → erin(active)
insert into public.sessions
  (id, applicant_id, recipient_id, consultant_id, teller_id, initiated_by, concern, status)
values
  ('00000000-0000-0000-0000-000000000501', '00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000b2',
   '00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000b2', 'consultant', 's1', 'pending'),
  ('00000000-0000-0000-0000-000000000502', '00000000-0000-0000-0000-0000000000b3', '00000000-0000-0000-0000-0000000000b1',
   '00000000-0000-0000-0000-0000000000b3', '00000000-0000-0000-0000-0000000000b1', 'consultant', 's2', 'pending'),
  ('00000000-0000-0000-0000-000000000503', '00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000b4',
   '00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000b4', 'consultant', 's3', 'completed'),
  ('00000000-0000-0000-0000-000000000504', '00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000b5',
   '00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000b5', 'consultant', 's4', 'active');

insert into public.messages (session_id, sender_id, content) values
  ('00000000-0000-0000-0000-000000000503', '00000000-0000-0000-0000-0000000000b1', 'ありがとうございました');

insert into public.reviews (session_id, reviewer_id, reviewee_id, rating, comment) values
  ('00000000-0000-0000-0000-000000000503', '00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000b4', 5, 'よかったです');

-- 1-3. 実行できるのは service_role(Edge Function)だけ
select is(has_function_privilege('anon', 'public.prepare_account_deletion(uuid)', 'execute'),
  false, 'anon は prepare_account_deletion を実行できない');
select is(has_function_privilege('authenticated', 'public.prepare_account_deletion(uuid)', 'execute'),
  false, 'authenticated は prepare_account_deletion を実行できない');
select is(has_function_privilege('service_role', 'public.prepare_account_deletion(uuid)', 'execute'),
  true, 'service_role は prepare_account_deletion を実行できる');

-- ===== service_role(Edge Function からの呼び出し。auth.uid() は null) =====
set local role service_role;
select set_config('request.jwt.claims', '{"role":"service_role"}', true);

-- 4. 進行中のセッションがあると退会できない
select throws_ok(
  $$ select public.prepare_account_deletion('00000000-0000-0000-0000-0000000000b1') $$,
  'P0001', 'the user has an active session',
  '進行中のセッションがあると例外になる'
);

-- 5. 例外のときは何も変わらない
select results_eq(
  $$ select (select status from public.sessions where id = '00000000-0000-0000-0000-000000000501'),
            (select status from public.sessions where id = '00000000-0000-0000-0000-000000000502'),
            (select status from public.consultation_posts where id = '00000000-0000-0000-0000-000000000a01'),
            (select display_name from public.profiles where id = '00000000-0000-0000-0000-0000000000b1'),
            (select count(*)::int from public.push_tokens where user_id = '00000000-0000-0000-0000-0000000000b1') $$,
  $$ values ('pending'::text, 'pending'::text, 'open'::text, 'アリス'::text, 1) $$,
  '進行中のセッションがあって例外になったときは、セッション・投稿・プロフィール・push token は変わらない'
);

-- 進行中のセッションを完了させてから退会する
update public.sessions set status = 'completed' where id = '00000000-0000-0000-0000-000000000504';

-- 15 で通知が増えていないことを確かめるため、退会前の件数を取っておく
create temporary table notification_count_before on commit drop as
  select count(*)::int as n from public.notifications;

-- 6. 進行中のセッションが無ければ退会できる
select lives_ok(
  $$ select public.prepare_account_deletion('00000000-0000-0000-0000-0000000000b1') $$,
  '進行中のセッションが無ければ退会の処理ができる'
);

-- 7. 承認待ちのセッションは、申し込んだもの・申し込まれたもののどちらも期限切れになる
select results_eq(
  $$ select id, status from public.sessions
      where id in ('00000000-0000-0000-0000-000000000501', '00000000-0000-0000-0000-000000000502')
      order by id $$,
  $$ values ('00000000-0000-0000-0000-000000000501'::uuid, 'expired'::text),
            ('00000000-0000-0000-0000-000000000502'::uuid, 'expired'::text) $$,
  '承認待ちのセッションは、申し込んだもの・申し込まれたもののどちらも expired になる'
);

-- 15. 期限切れにしても、相手には通知しない(通常の期限切れと同じ)
select is(
  (select count(*)::int from public.notifications),
  (select n from notification_count_before),
  '承認待ちを期限切れにしても、通知は作られない'
);

-- 8. 募集中の投稿は閉じる(閉じた投稿もそのまま)
select results_eq(
  $$ select status from public.consultation_posts
      where consultant_id = '00000000-0000-0000-0000-0000000000b1'
      order by id $$,
  $$ values ('closed'::text), ('closed'::text) $$,
  '募集中のお悩み投稿は closed になる'
);

-- 9. プロフィールは表示名を「退会したユーザー」にし、自己紹介・アイコンを空にする
select results_eq(
  $$ select display_name, bio, avatar_path, deleted_at is not null
       from public.profiles where id = '00000000-0000-0000-0000-0000000000b1' $$,
  $$ values ('退会したユーザー'::text, null::text, null::text, true) $$,
  'プロフィールの表示名が「退会したユーザー」になり、自己紹介・アイコンが空になり、deleted_at が入る'
);

-- 10. 生年月日・性別は消える
select is_empty(
  $$ select * from public.profile_private_details where profile_id = '00000000-0000-0000-0000-0000000000b1' $$,
  'profile_private_details の行が消える'
);

-- 11. 本人の push token だけが消える
select results_eq(
  $$ select user_id from public.push_tokens
      where user_id in ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000b2') $$,
  $$ values ('00000000-0000-0000-0000-0000000000b2'::uuid) $$,
  '本人の push token は消え、ほかの人の push token は残る'
);

-- 12. 相手側の記録として、セッション・メッセージ・レビューは残る
select results_eq(
  $$ select (select count(*)::int from public.sessions
              where '00000000-0000-0000-0000-0000000000b1' in (applicant_id, recipient_id)),
            (select count(*)::int from public.messages
              where sender_id = '00000000-0000-0000-0000-0000000000b1'),
            (select count(*)::int from public.reviews
              where reviewer_id = '00000000-0000-0000-0000-0000000000b1') $$,
  $$ values (4, 1, 1) $$,
  'セッション・メッセージ・レビューは残る'
);

-- 13. 2回目の呼び出し(auth のユーザー削除に失敗したあとの再実行)でもエラーにならない
select lives_ok(
  $$ select public.prepare_account_deletion('00000000-0000-0000-0000-0000000000b1') $$,
  '2回呼んでもエラーにならない'
);

-- 14. 2回目でも結果は変わらない
select results_eq(
  $$ select display_name, bio, avatar_path, deleted_at is not null
       from public.profiles where id = '00000000-0000-0000-0000-0000000000b1' $$,
  $$ values ('退会したユーザー'::text, null::text, null::text, true) $$,
  '2回呼んでも、プロフィールは退会済みのまま'
);

reset role;
select set_config('request.jwt.claims', '', true);

select * from finish();
rollback;
