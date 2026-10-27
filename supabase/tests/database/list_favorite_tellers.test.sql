begin;
select plan(11);

-- ===== テストデータ(postgres 権限)=====
-- a1: お気に入りを登録している相談者 / a2: 別の相談者 / a3: お気に入りが無い相談者
-- t1: 受付中の占い師 / t2: 受付停止中の占い師 / t3: 退会した占い師
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000a1', 'a1@example.com', '{"display_name":"相談者1"}'),
  ('00000000-0000-0000-0000-0000000000a2', 'a2@example.com', '{"display_name":"相談者2"}'),
  ('00000000-0000-0000-0000-0000000000a3', 'a3@example.com', '{"display_name":"相談者3"}'),
  ('00000000-0000-0000-0000-0000000000b1', 't1@example.com', '{"display_name":"占い師1"}'),
  ('00000000-0000-0000-0000-0000000000b2', 't2@example.com', '{"display_name":"占い師2"}'),
  ('00000000-0000-0000-0000-0000000000b3', 't3@example.com', '{"display_name":"占い師3"}');

insert into public.teller_profiles (profile_id, self_pr, training_period, is_accepting) values
  ('00000000-0000-0000-0000-0000000000b1', 't1 の自己PR', '半年', true),
  ('00000000-0000-0000-0000-0000000000b2', 't2 の自己PR', null,   false),
  ('00000000-0000-0000-0000-0000000000b3', 't3 の自己PR', null,   true);

-- 列の確認用に t1 だけキャッシュ値・アイコン・タグを入れる
update public.teller_profiles
   set average_rating = 4.50, review_count = 2, session_count = 3
 where profile_id = '00000000-0000-0000-0000-0000000000b1';

update public.profiles
   set avatar_path = '00000000-0000-0000-0000-0000000000b1/1730000000000.jpg'
 where id = '00000000-0000-0000-0000-0000000000b1';

insert into public.tags (id, category, slug, name, sort_order) values
  ('00000000-0000-0000-0000-000000000b01', 'divination', 'test-fav-div', 'テスト占術', 1);

insert into public.teller_tags (teller_id, tag_id) values
  ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-000000000b01');

-- t3 は退会済み
update public.profiles
   set deleted_at = now()
 where id = '00000000-0000-0000-0000-0000000000b3';

-- 同じトランザクション内では now() が同じになるため、created_at は日をずらして入れる
--   a1: t1(3日前)・t2(2日前)・t3(1日前) → 一覧は t2, t1(t3 は退会済みなので出ない)
--   a2: t1(今)
insert into public.favorites (consultant_id, teller_id, created_at) values
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b1', now() - interval '3 days'),
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b2', now() - interval '2 days'),
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b3', now() - interval '1 day'),
  ('00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000b1', now());

-- 1-2. 実行権限
select is(
  has_function_privilege('anon', 'public.list_favorite_tellers()', 'execute'),
  false,
  'anon は list_favorite_tellers を実行できない'
);
select ok(
  has_function_privilege('authenticated', 'public.list_favorite_tellers()', 'execute'),
  'authenticated は list_favorite_tellers を実行できる'
);

-- ===== 未ログイン(anon)=====
set local role anon;

-- 3. anon が呼ぶと権限エラー
select throws_ok(
  $$ select * from public.list_favorite_tellers() $$,
  '42501', null,
  'anon が list_favorite_tellers を呼ぶと権限エラー'
);
reset role;

-- ===== a1 =====
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);

-- 4. 自分の分だけ、登録の新しい順に返る(退会した占い師は出ない)
select results_eq(
  $$ select teller_id from public.list_favorite_tellers() $$,
  $$ values ('00000000-0000-0000-0000-0000000000b2'::uuid),
            ('00000000-0000-0000-0000-0000000000b1'::uuid) $$,
  'a1 には自分のお気に入りが登録の新しい順に返る'
);

-- 5. 受付停止中の占い師も返る
select is(
  (select is_accepting from public.list_favorite_tellers()
    where teller_id = '00000000-0000-0000-0000-0000000000b2'),
  false,
  '受付停止中の占い師も返る'
);

-- 6. 退会した占い師は返らない
select is(
  (select count(*)::int from public.list_favorite_tellers()
    where teller_id = '00000000-0000-0000-0000-0000000000b3'),
  0,
  '退会した占い師は返らない'
);

-- 7. 列の中身(tags 以外)
select results_eq(
  $$ select display_name, avatar_path, self_pr, training_period, is_accepting,
            average_rating, review_count, session_count
       from public.list_favorite_tellers()
      where teller_id = '00000000-0000-0000-0000-0000000000b1' $$,
  $$ values ('占い師1'::text, '00000000-0000-0000-0000-0000000000b1/1730000000000.jpg'::text,
             't1 の自己PR'::text, '半年'::text, true, 4.50::numeric, 2, 3) $$,
  '占い師の表示名・アイコン・自己PR・キャッシュ値が返る'
);

-- 8. tags は list_teller_tags_json と同じ中身
select is(
  (select tags from public.list_favorite_tellers()
    where teller_id = '00000000-0000-0000-0000-0000000000b1'),
  public.list_teller_tags_json('00000000-0000-0000-0000-0000000000b1'),
  'tags は list_teller_tags_json と同じ中身'
);

-- 9. tags にテストのタグが入っている(8 が空配列どうしで通らないことの確認)
select is(
  (select jsonb_array_length(tags) from public.list_favorite_tellers()
    where teller_id = '00000000-0000-0000-0000-0000000000b1'),
  1,
  'tags に占い師のタグが入る'
);

-- ===== a2 =====
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated"}', true);

-- 10. 他人のお気に入りは返らない
select results_eq(
  $$ select teller_id from public.list_favorite_tellers() $$,
  $$ values ('00000000-0000-0000-0000-0000000000b1'::uuid) $$,
  'a2 には自分のお気に入りだけが返る'
);

-- ===== a3 =====
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000a3","role":"authenticated"}', true);

-- 11. お気に入りが無ければ 0 件
select is_empty(
  $$ select * from public.list_favorite_tellers() $$,
  'お気に入りが無ければ 0 件'
);

reset role;

select * from finish();
rollback;
