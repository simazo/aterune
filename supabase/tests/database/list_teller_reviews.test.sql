begin;
select plan(7);

-- ===== テストデータ(postgres 権限)=====
-- carol=相談者 / t1・t2=占い師 / dave=無関係のユーザー
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000c1', 'carol@example.com'),
  ('00000000-0000-0000-0000-0000000000e1', 't1@example.com'),
  ('00000000-0000-0000-0000-0000000000e2', 't2@example.com'),
  ('00000000-0000-0000-0000-0000000000d3', 'dave@example.com');

insert into public.teller_profiles (profile_id) values
  ('00000000-0000-0000-0000-0000000000e1'),
  ('00000000-0000-0000-0000-0000000000e2');

-- s1〜s4: carol → t1 / s5: carol → t2(いずれも completed)
insert into public.sessions
  (id, applicant_id, recipient_id, consultant_id, teller_id, initiated_by, concern, status, completed_at)
select s.id, '00000000-0000-0000-0000-0000000000c1', s.teller_id,
       '00000000-0000-0000-0000-0000000000c1', s.teller_id,
       'consultant', s.name, 'completed', now() - interval '1 day'
from (values
  ('00000000-0000-0000-0000-000000000901'::uuid, '00000000-0000-0000-0000-0000000000e1'::uuid, 's1'),
  ('00000000-0000-0000-0000-000000000902'::uuid, '00000000-0000-0000-0000-0000000000e1'::uuid, 's2'),
  ('00000000-0000-0000-0000-000000000903'::uuid, '00000000-0000-0000-0000-0000000000e1'::uuid, 's3'),
  ('00000000-0000-0000-0000-000000000904'::uuid, '00000000-0000-0000-0000-0000000000e1'::uuid, 's4'),
  ('00000000-0000-0000-0000-000000000905'::uuid, '00000000-0000-0000-0000-0000000000e2'::uuid, 's5')
) as s(id, teller_id, name);

-- t1 のレビュー: r2(10/3)→ r3・r4(どちらも 10/2。id 順)→ r1(10/1)の順に並ぶ
insert into public.reviews (id, session_id, reviewer_id, reviewee_id, rating, comment, created_at)
select r.id, r.session_id, '00000000-0000-0000-0000-0000000000c1', r.reviewee_id, r.rating, r.comment, r.created_at
from (values
  ('00000000-0000-0000-0000-00000000a001'::uuid, '00000000-0000-0000-0000-000000000901'::uuid,
   '00000000-0000-0000-0000-0000000000e1'::uuid, 3::smallint, 'r1'::text, '2026-10-01 12:00:00+09'::timestamptz),
  ('00000000-0000-0000-0000-00000000a002'::uuid, '00000000-0000-0000-0000-000000000902'::uuid,
   '00000000-0000-0000-0000-0000000000e1'::uuid, 5::smallint, 'r2'::text, '2026-10-03 12:00:00+09'::timestamptz),
  ('00000000-0000-0000-0000-00000000a003'::uuid, '00000000-0000-0000-0000-000000000903'::uuid,
   '00000000-0000-0000-0000-0000000000e1'::uuid, 4::smallint, null::text, '2026-10-02 12:00:00+09'::timestamptz),
  ('00000000-0000-0000-0000-00000000a004'::uuid, '00000000-0000-0000-0000-000000000904'::uuid,
   '00000000-0000-0000-0000-0000000000e1'::uuid, 2::smallint, 'r4'::text, '2026-10-02 12:00:00+09'::timestamptz),
  ('00000000-0000-0000-0000-00000000a005'::uuid, '00000000-0000-0000-0000-000000000905'::uuid,
   '00000000-0000-0000-0000-0000000000e2'::uuid, 1::smallint, 'r5'::text, '2026-10-04 12:00:00+09'::timestamptz)
) as r(id, session_id, reviewee_id, rating, comment, created_at);

-- 1-2. 実行権限
select ok(
  has_function_privilege('anon', 'public.list_teller_reviews(uuid, integer)', 'execute'),
  'anon は list_teller_reviews を実行できる'
);
select ok(
  has_function_privilege('authenticated', 'public.list_teller_reviews(uuid, integer)', 'execute'),
  'authenticated は list_teller_reviews を実行できる'
);

-- 3. 誰がどの占い師に相談したかが分からないよう、reviewer_id・session_id は返さない
select is(
  pg_get_function_result('public.list_teller_reviews(uuid, integer)'::regprocedure),
  'TABLE(id uuid, rating smallint, comment text, created_at timestamp with time zone)',
  '返す列は id・rating・comment・created_at だけ(reviewer_id・session_id を含まない)'
);

-- ===== 未ログイン(anon)=====
set local role anon;

-- 4. 新しい順(同じ日時なら id 順)に、評価・コメント・日時を返す
select results_eq(
  $$ select id, rating, comment, created_at
       from public.list_teller_reviews('00000000-0000-0000-0000-0000000000e1', 10) $$,
  $$ values
       ('00000000-0000-0000-0000-00000000a002'::uuid, 5::smallint, 'r2'::text, '2026-10-03 12:00:00+09'::timestamptz),
       ('00000000-0000-0000-0000-00000000a003'::uuid, 4::smallint, null::text, '2026-10-02 12:00:00+09'::timestamptz),
       ('00000000-0000-0000-0000-00000000a004'::uuid, 2::smallint, 'r4'::text, '2026-10-02 12:00:00+09'::timestamptz),
       ('00000000-0000-0000-0000-00000000a001'::uuid, 3::smallint, 'r1'::text, '2026-10-01 12:00:00+09'::timestamptz) $$,
  '指定した占い師のレビューだけを、新しい順(同じ日時なら id 順)に返す'
);

-- 5. p_limit 件まで
select results_eq(
  $$ select id from public.list_teller_reviews('00000000-0000-0000-0000-0000000000e1', 2) $$,
  $$ values ('00000000-0000-0000-0000-00000000a002'::uuid), ('00000000-0000-0000-0000-00000000a003'::uuid) $$,
  'p_limit 件まで返す'
);

-- 6. レビューの無い占い師・存在しない ID は0行
select is(
  (select count(*)::int from public.list_teller_reviews('00000000-0000-0000-0000-0000000000d3', 10)),
  0, 'レビューの無いユーザーなら0行'
);
reset role;

-- ===== dave(当事者でないログイン中のユーザー)=====
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000d3","role":"authenticated"}', true);

-- 7. 当事者でなくても、公開の一覧は読める
select is(
  (select count(*)::int from public.list_teller_reviews('00000000-0000-0000-0000-0000000000e2', 10)),
  1, '当事者でないログイン中のユーザーも、占い師のレビュー一覧を読める'
);
reset role;

select * from finish();
rollback;
