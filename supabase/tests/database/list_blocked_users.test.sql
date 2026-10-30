begin;
select plan(5);

-- ===== テストデータ(postgres 権限) =====
-- alice が bob・carol・dave をブロックしている。dave は退会済み。erin は bob をブロックしている
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000b1', 'alice@example.com', '{"display_name":"アリス"}'),
  ('00000000-0000-0000-0000-0000000000b2', 'bob@example.com',   '{"display_name":"ボブ"}'),
  ('00000000-0000-0000-0000-0000000000b3', 'carol@example.com', '{"display_name":"キャロル"}'),
  ('00000000-0000-0000-0000-0000000000b4', 'dave@example.com',  '{"display_name":"デイブ"}'),
  ('00000000-0000-0000-0000-0000000000b5', 'erin@example.com',  '{"display_name":"エリン"}');

-- アイコンは bob だけに入れる(列の確認用)
update public.profiles
   set avatar_path = '00000000-0000-0000-0000-0000000000b2/1730000000000.jpg'
 where id = '00000000-0000-0000-0000-0000000000b2';

update public.profiles set deleted_at = now() where id = '00000000-0000-0000-0000-0000000000b4';

-- 同じトランザクション内では now() が同じになるため、created_at はずらして入れる
insert into public.blocks (blocker_id, blocked_id, created_at) values
  ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000b2', now() - interval '2 days'),
  ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000b3', now() - interval '1 day'),
  ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000b4', now()),
  ('00000000-0000-0000-0000-0000000000b5', '00000000-0000-0000-0000-0000000000b2', now());

-- 1-2. 呼べるのはログイン中のユーザーだけ
select is(has_function_privilege('anon', 'public.list_blocked_users()', 'execute'),
  false, 'anon は list_blocked_users を実行できない');
select is(has_function_privilege('authenticated', 'public.list_blocked_users()', 'execute'),
  true, 'authenticated は list_blocked_users を実行できる');

-- ===== authenticated(alice) =====
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}', true);

-- 3. 自分のブロックだけを、ブロックの新しい順に返す。退会した相手(dave)は除く
select results_eq(
  $$ select blocked_id, display_name, avatar_path from public.list_blocked_users() $$,
  $$ values
     ('00000000-0000-0000-0000-0000000000b3'::uuid, 'キャロル'::text, null::text),
     ('00000000-0000-0000-0000-0000000000b2'::uuid, 'ボブ'::text,
      '00000000-0000-0000-0000-0000000000b2/1730000000000.jpg'::text) $$,
  '自分のブロックを新しい順に返し、退会した相手は除く'
);

-- 4. ブロックした日時も返す
select is(
  (select created_at from public.list_blocked_users()
    where blocked_id = '00000000-0000-0000-0000-0000000000b3'),
  now() - interval '1 day',
  'ブロックした日時を返す'
);

-- ===== authenticated(bob。alice・erin にブロックされている) =====
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000b2","role":"authenticated"}', true);

-- 5. ブロックされているだけなら、一覧には何も出ない
select is_empty(
  $$ select * from public.list_blocked_users() $$,
  'ブロックされた側の一覧には、相手のブロックは出ない'
);
reset role;

select * from finish();
rollback;
