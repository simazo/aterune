begin;
select plan(37);

-- ---------- 準備 ----------
-- profiles は handle_new_user のトリガーで自動作成される
insert into auth.users (id, aud, role, email) values
  ('00000000-0000-0000-0000-0000000000c1', 'authenticated', 'authenticated', 'alice@example.com'),
  ('00000000-0000-0000-0000-0000000000c2', 'authenticated', 'authenticated', 'bob@example.com'),
  ('00000000-0000-0000-0000-0000000000c3', 'authenticated', 'authenticated', 'carol@example.com');

-- alice(c1)だけ占い師として登録済みにしておく(postgres 権限)
insert into public.teller_profiles (profile_id, self_pr)
  values ('00000000-0000-0000-0000-0000000000c1', 'alice の自己PR');

-- ---------- 1-3. 構造 ----------
select is(
  (select relrowsecurity from pg_class where oid = 'public.teller_profiles'::regclass),
  true,
  'teller_profiles は RLS が有効'
);

select has_trigger('public', 'teller_profiles', 'teller_profiles_set_updated_at',
  'teller_profiles に updated_at 用のトリガーが付いている');

select has_trigger('public', 'teller_profiles', 'teller_profiles_sync_is_teller',
  'teller_profiles に is_teller 同期用のトリガーが付いている');

-- ---------- 4-5. 同期関数を API から呼べないこと ----------
select is(
  has_function_privilege('anon', 'public.sync_is_teller()', 'execute'),
  false,
  'anon は sync_is_teller を実行できない'
);

select is(
  has_function_privilege('authenticated', 'public.sync_is_teller()', 'execute'),
  false,
  'authenticated は sync_is_teller を実行できない'
);

-- ---------- 6. 登録すると is_teller が true になる ----------
select is(
  (select is_teller from public.profiles
    where id = '00000000-0000-0000-0000-0000000000c1'),
  true,
  '占い師登録されると profiles.is_teller が true になる'
);

-- ---------- 7-8. anon(未ログイン) ----------
set local role anon;

-- seed などテスト外の行に左右されないよう、テストで入れた行だけを数える
select is(
  (select count(*)::int from public.teller_profiles
    where profile_id = '00000000-0000-0000-0000-0000000000c1'),
  1,
  'anon は占い師プロフィールを読める'
);

select throws_ok(
  $$ insert into public.teller_profiles (profile_id)
       values ('00000000-0000-0000-0000-0000000000c3') $$,
  '42501',
  null,
  'anon は INSERT できない'
);

reset role;

-- ---------- 9-23. authenticated(bob = c2 としてログイン) ----------
set local role authenticated;
set local request.jwt.claims =
  '{"sub":"00000000-0000-0000-0000-0000000000c2","role":"authenticated"}';

select lives_ok(
  $$ insert into public.teller_profiles (profile_id, self_pr)
       values ('00000000-0000-0000-0000-0000000000c2', 'bob の自己PR') $$,
  '自分自身を占い師として登録できる'
);

select is(
  (select is_teller from public.profiles
    where id = '00000000-0000-0000-0000-0000000000c2'),
  true,
  'ユーザー自身の登録でも、トリガー経由で is_teller が true になる'
);

select throws_ok(
  $$ insert into public.teller_profiles (profile_id)
       values ('00000000-0000-0000-0000-0000000000c3') $$,
  '42501',
  null,
  '他人(carol)を占い師として登録することはできない'
);

select lives_ok(
  $$ update public.teller_profiles set self_pr = '更新しました'
       where profile_id = '00000000-0000-0000-0000-0000000000c2' $$,
  '自分の占い師プロフィールは更新できる'
);

select results_eq(
  $$ with u as (
       update public.teller_profiles set self_pr = 'hacked'
         where profile_id = '00000000-0000-0000-0000-0000000000c1' returning 1
     ) select count(*)::int from u $$,
  array[0],
  '他人の占い師プロフィールは更新できない(0行)'
);

select throws_ok(
  $$ update public.teller_profiles set average_rating = 5.00
       where profile_id = '00000000-0000-0000-0000-0000000000c2' $$,
  '42501',
  null,
  '自分で average_rating は書き換えられない'
);

select throws_ok(
  $$ update public.teller_profiles set review_count = 999
       where profile_id = '00000000-0000-0000-0000-0000000000c2' $$,
  '42501',
  null,
  '自分で review_count は書き換えられない'
);

select throws_ok(
  $$ update public.teller_profiles set session_count = 999
       where profile_id = '00000000-0000-0000-0000-0000000000c2' $$,
  '42501',
  null,
  '自分で session_count は書き換えられない'
);

select lives_ok(
  $$ update public.teller_profiles set training_period = '半年'
       where profile_id = '00000000-0000-0000-0000-0000000000c2' $$,
  '自分で training_period(修行期間)を設定できる'
);

select lives_ok(
  $$ update public.teller_profiles set training_period = null
       where profile_id = '00000000-0000-0000-0000-0000000000c2' $$,
  'training_period は未入力(NULL)に戻せる'
);

select throws_ok(
  $$ update public.teller_profiles set training_period = ' 　'
       where profile_id = '00000000-0000-0000-0000-0000000000c2' $$,
  '23514',
  null,
  'training_period は空白だけにできない(半角・全角とも)'
);

select throws_ok(
  $$ update public.teller_profiles set training_period = repeat('あ', 21)
       where profile_id = '00000000-0000-0000-0000-0000000000c2' $$,
  '23514',
  null,
  'training_period は 21 文字以上にできない'
);

select lives_ok(
  $$ update public.teller_profiles set self_pr = repeat('あ', 1000)
       where profile_id = '00000000-0000-0000-0000-0000000000c2' $$,
  'self_pr は 1000 文字まで設定できる'
);

select throws_ok(
  $$ update public.teller_profiles set self_pr = repeat('あ', 1001)
       where profile_id = '00000000-0000-0000-0000-0000000000c2' $$,
  '23514',
  null,
  'self_pr は 1001 文字以上にできない'
);

select throws_ok(
  $$ delete from public.teller_profiles
       where profile_id = '00000000-0000-0000-0000-0000000000c2' $$,
  '42501',
  null,
  '一般ユーザーは占い師登録を削除できない(現在の仕様)'
);

reset role;

-- ---------- 24-25. 削除すると is_teller が戻る ----------
select lives_ok(
  $$ delete from public.teller_profiles
       where profile_id = '00000000-0000-0000-0000-0000000000c1' $$,
  'システム側からは占い師登録を削除できる'
);

select is(
  (select is_teller from public.profiles
    where id = '00000000-0000-0000-0000-0000000000c1'),
  false,
  '削除されると profiles.is_teller が false に戻る'
);

-- ---------- 26. ユーザー削除の連鎖 ----------
select lives_ok(
  $$ delete from auth.users
       where id = '00000000-0000-0000-0000-0000000000c2' $$,
  '占い師のユーザーを削除しても、連鎖削除がエラーにならない'
);

-- ---------- 27-37. セッションがある占い師がやめるとき ----------
-- dana(d1)=相談者 / d2〜d7=占い師(セッションの状態ごとに分ける)
insert into auth.users (id, aud, role, email) values
  ('00000000-0000-0000-0000-0000000000d1', 'authenticated', 'authenticated', 'dana@example.com'),
  ('00000000-0000-0000-0000-0000000000d2', 'authenticated', 'authenticated', 'teller-finished@example.com'),
  ('00000000-0000-0000-0000-0000000000d3', 'authenticated', 'authenticated', 'teller-active@example.com'),
  ('00000000-0000-0000-0000-0000000000d4', 'authenticated', 'authenticated', 'teller-pending@example.com'),
  ('00000000-0000-0000-0000-0000000000d5', 'authenticated', 'authenticated', 'teller-applied@example.com'),
  ('00000000-0000-0000-0000-0000000000d6', 'authenticated', 'authenticated', 'teller-expired@example.com'),
  ('00000000-0000-0000-0000-0000000000d7', 'authenticated', 'authenticated', 'teller-withdraw@example.com');

insert into public.teller_profiles (profile_id) values
  ('00000000-0000-0000-0000-0000000000d2'),
  ('00000000-0000-0000-0000-0000000000d3'),
  ('00000000-0000-0000-0000-0000000000d4'),
  ('00000000-0000-0000-0000-0000000000d5'),
  ('00000000-0000-0000-0000-0000000000d6'),
  ('00000000-0000-0000-0000-0000000000d7');

-- seed に依存しないよう、テスト用の悩みタグと dana のお悩み投稿を作る
insert into public.tags (id, category, slug, name) values
  ('00000000-0000-0000-0000-0000000000e1', 'concern', 'test-concern-a', 'テスト悩みA');

insert into public.consultation_posts (id, consultant_id, concern_tag_id, concern) values
  ('00000000-0000-0000-0000-000000000a01', '00000000-0000-0000-0000-0000000000d1',
   '00000000-0000-0000-0000-0000000000e1', 'danaの悩み');

-- d2: 終わったセッションだけ / d3: active / d4: 期限内の pending(相談者から)/ d6: 期限切れの pending / d7: active
insert into public.sessions
  (id, applicant_id, recipient_id, consultant_id, teller_id, initiated_by, concern, status, expires_at)
select v.id, '00000000-0000-0000-0000-0000000000d1', v.teller,
       '00000000-0000-0000-0000-0000000000d1', v.teller, 'consultant', 'x', v.status, v.expires_at
  from (values
    ('00000000-0000-0000-0000-000000000d21'::uuid, '00000000-0000-0000-0000-0000000000d2'::uuid, 'completed',      now() + interval '48 hours'),
    ('00000000-0000-0000-0000-000000000d22'::uuid, '00000000-0000-0000-0000-0000000000d2'::uuid, 'auto_completed', now() + interval '48 hours'),
    ('00000000-0000-0000-0000-000000000d23'::uuid, '00000000-0000-0000-0000-0000000000d2'::uuid, 'rejected',       now() + interval '48 hours'),
    ('00000000-0000-0000-0000-000000000d24'::uuid, '00000000-0000-0000-0000-0000000000d2'::uuid, 'expired',        now() + interval '48 hours'),
    ('00000000-0000-0000-0000-000000000d31'::uuid, '00000000-0000-0000-0000-0000000000d3'::uuid, 'active',         now() + interval '48 hours'),
    ('00000000-0000-0000-0000-000000000d41'::uuid, '00000000-0000-0000-0000-0000000000d4'::uuid, 'pending',        now() + interval '48 hours'),
    ('00000000-0000-0000-0000-000000000d61'::uuid, '00000000-0000-0000-0000-0000000000d6'::uuid, 'pending',        now() - interval '1 hour'),
    ('00000000-0000-0000-0000-000000000d71'::uuid, '00000000-0000-0000-0000-0000000000d7'::uuid, 'active',         now() + interval '48 hours')
  ) as v (id, teller, status, expires_at);

-- d5: dana の投稿への応募(期限内の pending)
insert into public.sessions
  (id, applicant_id, recipient_id, consultant_id, teller_id, initiated_by, post_id)
values
  ('00000000-0000-0000-0000-000000000d51', '00000000-0000-0000-0000-0000000000d5', '00000000-0000-0000-0000-0000000000d1',
   '00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000d5', 'teller',
   '00000000-0000-0000-0000-000000000a01');

insert into public.messages (session_id, sender_id, content) values
  ('00000000-0000-0000-0000-000000000d21', '00000000-0000-0000-0000-0000000000d1', 'ありがとうございました');

select has_trigger('public', 'teller_profiles', 'teller_profiles_guard_delete',
  'teller_profiles に、やめるときのガード用のトリガーが付いている');

select lives_ok(
  $$ delete from public.teller_profiles
       where profile_id = '00000000-0000-0000-0000-0000000000d2' $$,
  '終わったセッション(completed / auto_completed / rejected / expired)しかなければ、占い師をやめられる'
);

set local role authenticated;
set local request.jwt.claims =
  '{"sub":"00000000-0000-0000-0000-0000000000d1","role":"authenticated"}';

select is(
  (select count(*)::int from public.sessions
    where teller_id = '00000000-0000-0000-0000-0000000000d2'),
  4,
  '占い師がやめたあとも、相談者はそのセッションを読める'
);

select is(
  (select count(*)::int from public.messages
    where session_id = '00000000-0000-0000-0000-000000000d21'),
  1,
  '占い師がやめたあとも、相談者はそのセッションのメッセージを読める'
);

set local request.jwt.claims =
  '{"sub":"00000000-0000-0000-0000-0000000000d2","role":"authenticated"}';

select is(
  (select count(*)::int from public.sessions
    where teller_id = '00000000-0000-0000-0000-0000000000d2'),
  4,
  '占い師をやめたあとも、本人は自分の過去のセッションを読める'
);

reset role;

select throws_ok(
  $$ delete from public.teller_profiles
       where profile_id = '00000000-0000-0000-0000-0000000000d3' $$,
  'P0001',
  null,
  '進行中(active)のセッションがあれば、占い師をやめられない'
);

select throws_ok(
  $$ delete from public.teller_profiles
       where profile_id = '00000000-0000-0000-0000-0000000000d4' $$,
  'P0001',
  null,
  '相談者からの期限内の申込み(pending)があれば、占い師をやめられない'
);

select throws_ok(
  $$ delete from public.teller_profiles
       where profile_id = '00000000-0000-0000-0000-0000000000d5' $$,
  'P0001',
  null,
  'お悩み投稿への期限内の応募(pending)があれば、占い師をやめられない'
);

select lives_ok(
  $$ delete from public.teller_profiles
       where profile_id = '00000000-0000-0000-0000-0000000000d6' $$,
  '期限切れの pending しかなければ、定期処理で expired になる前でも占い師をやめられる'
);

select lives_ok(
  $$ delete from auth.users
       where id = '00000000-0000-0000-0000-0000000000d7' $$,
  '進行中のセッションがあっても、占い師のユーザーは退会できる'
);

select is(
  (select count(*)::int from public.sessions
    where id = '00000000-0000-0000-0000-000000000d71'),
  0,
  '退会すると、その占い師のセッションも消える'
);

select * from finish();
rollback;