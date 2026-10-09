begin;
select plan(22);

-- ===== テストデータ(postgres 権限)=====
-- carol=相談者 / bob=占い師 / dave=無関係のユーザー
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000c1', 'carol@example.com'),
  ('00000000-0000-0000-0000-0000000000b2', 'bob@example.com'),
  ('00000000-0000-0000-0000-0000000000d3', 'dave@example.com');

insert into public.teller_profiles (profile_id) values
  ('00000000-0000-0000-0000-0000000000b2');

-- s1: completed(1日前に完了)/ s2: completed(8日前に完了=期限切れ)/ s3: auto_completed
-- s4: active / s6: completed(seed のレビュー付き)/ s7: completed(未レビュー、制約テスト用)
insert into public.sessions
  (id, applicant_id, recipient_id, consultant_id, teller_id, initiated_by, concern, status, completed_at)
select s.id, '00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000b2',
       '00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000b2',
       'consultant', s.name, s.status, s.completed_at
from (values
  ('00000000-0000-0000-0000-000000000801'::uuid, 's1', 'completed',      now() - interval '1 day'),
  ('00000000-0000-0000-0000-000000000802'::uuid, 's2', 'completed',      now() - interval '8 days'),
  ('00000000-0000-0000-0000-000000000803'::uuid, 's3', 'auto_completed', now()),
  ('00000000-0000-0000-0000-000000000804'::uuid, 's4', 'active',         null),
  ('00000000-0000-0000-0000-000000000806'::uuid, 's6', 'completed',      now() - interval '1 day'),
  ('00000000-0000-0000-0000-000000000807'::uuid, 's7', 'completed',      now() - interval '1 day')
) as s(id, name, status, completed_at);

-- s6 には評価5の seed レビューがある(→ bob のキャッシュは件数1・平均5.00)
insert into public.reviews (session_id, reviewer_id, reviewee_id, rating) values
  ('00000000-0000-0000-0000-000000000806', '00000000-0000-0000-0000-0000000000c1',
   '00000000-0000-0000-0000-0000000000b2', 5);

-- 1. RLS が有効
select ok(
  (select relrowsecurity from pg_class where oid = 'public.reviews'::regclass),
  'reviews: RLS が有効'
);

-- ===== anon =====
set local role anon;

-- 2. anon も select できる(公開情報)
select is(
  (select count(*)::int from public.reviews where session_id = '00000000-0000-0000-0000-000000000806'),
  1, 'anon は reviews を select できる'
);

-- 3. anon は insert できない
select throws_ok(
  $$ insert into public.reviews (session_id, reviewer_id, reviewee_id, rating) values
     ('00000000-0000-0000-0000-000000000801', '00000000-0000-0000-0000-0000000000c1',
      '00000000-0000-0000-0000-0000000000b2', 4) $$,
  '42501', null, 'anon は reviews を insert できない'
);
reset role;

-- ===== carol(相談者)=====
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}', true);

-- 4. 完了後7日以内の completed セッションに評価できる
select lives_ok(
  $$ insert into public.reviews (session_id, reviewer_id, reviewee_id, rating) values
     ('00000000-0000-0000-0000-000000000801', '00000000-0000-0000-0000-0000000000c1',
      '00000000-0000-0000-0000-0000000000b2', 4) $$,
  '相談者は completed(7日以内)のセッションに評価できる'
);

-- 5. 同じセッションに2回は評価できない
select throws_ok(
  $$ insert into public.reviews (session_id, reviewer_id, reviewee_id, rating) values
     ('00000000-0000-0000-0000-000000000801', '00000000-0000-0000-0000-0000000000c1',
      '00000000-0000-0000-0000-0000000000b2', 3) $$,
  '23505', null, '1セッションにつき評価は1回まで'
);

-- 6. 完了から7日を過ぎたら評価できない
select throws_ok(
  $$ insert into public.reviews (session_id, reviewer_id, reviewee_id, rating) values
     ('00000000-0000-0000-0000-000000000802', '00000000-0000-0000-0000-0000000000c1',
      '00000000-0000-0000-0000-0000000000b2', 4) $$,
  '42501', null, '完了から7日を過ぎたら評価できない'
);

-- 7. auto_completed は評価できない
select throws_ok(
  $$ insert into public.reviews (session_id, reviewer_id, reviewee_id, rating) values
     ('00000000-0000-0000-0000-000000000803', '00000000-0000-0000-0000-0000000000c1',
      '00000000-0000-0000-0000-0000000000b2', 4) $$,
  '42501', null, 'auto_completed は評価できない'
);

-- 8. active(完了前)は評価できない
select throws_ok(
  $$ insert into public.reviews (session_id, reviewer_id, reviewee_id, rating) values
     ('00000000-0000-0000-0000-000000000804', '00000000-0000-0000-0000-0000000000c1',
      '00000000-0000-0000-0000-0000000000b2', 4) $$,
  '42501', null, 'active のセッションは評価できない'
);

-- 9. 他人名義(reviewer_id が自分でない)では評価できない
select throws_ok(
  $$ insert into public.reviews (session_id, reviewer_id, reviewee_id, rating) values
     ('00000000-0000-0000-0000-000000000807', '00000000-0000-0000-0000-0000000000b2',
      '00000000-0000-0000-0000-0000000000c1', 4) $$,
  '42501', null, '他人名義では評価できない'
);

-- 10. 評価対象がセッションの占い師でなければ評価できない
select throws_ok(
  $$ insert into public.reviews (session_id, reviewer_id, reviewee_id, rating) values
     ('00000000-0000-0000-0000-000000000807', '00000000-0000-0000-0000-0000000000c1',
      '00000000-0000-0000-0000-0000000000d3', 4) $$,
  '42501', null, 'reviewee_id がセッションの占い師でなければ評価できない'
);

-- 11. 評価点は 1〜5
select throws_ok(
  $$ insert into public.reviews (session_id, reviewer_id, reviewee_id, rating) values
     ('00000000-0000-0000-0000-000000000807', '00000000-0000-0000-0000-0000000000c1',
      '00000000-0000-0000-0000-0000000000b2', 6) $$,
  '23514', null, 'rating は 1〜5 の範囲外を入れられない'
);

-- 12. update できない
select throws_ok(
  $$ update public.reviews set rating = 1 $$,
  '42501', null, 'authenticated は reviews を update できない'
);

-- 13. delete できない
select throws_ok(
  $$ delete from public.reviews $$,
  '42501', null, 'authenticated は reviews を delete できない'
);
reset role;

-- ===== dave(当事者でない)=====
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000d3","role":"authenticated"}', true);

-- 14. 相談者でない人は評価できない
select throws_ok(
  $$ insert into public.reviews (session_id, reviewer_id, reviewee_id, rating) values
     ('00000000-0000-0000-0000-000000000807', '00000000-0000-0000-0000-0000000000d3',
      '00000000-0000-0000-0000-0000000000b2', 4) $$,
  '42501', null, '相談者でない人は評価できない'
);
reset role;

-- ===== 評価キャッシュ(teller_profiles)=====
-- 15. 件数: seed(5)+ carol(4)= 2件
select is(
  (select review_count from public.teller_profiles where profile_id = '00000000-0000-0000-0000-0000000000b2'),
  2, '評価の投稿で review_count が更新される'
);

-- 16. 平均: (5 + 4) / 2 = 4.50
select is(
  (select average_rating from public.teller_profiles where profile_id = '00000000-0000-0000-0000-0000000000b2'),
  4.50, '評価の投稿で average_rating が更新される'
);

-- 17. 評価が消えるとキャッシュも再計算される(carol の評価を削除 → 1件)
delete from public.reviews where session_id = '00000000-0000-0000-0000-000000000801';
select is(
  (select review_count from public.teller_profiles where profile_id = '00000000-0000-0000-0000-0000000000b2'),
  1, '評価の削除で review_count が再計算される'
);

-- 18. セッションを消すとレビューも連鎖削除される
delete from public.sessions where id = '00000000-0000-0000-0000-000000000806';
select is(
  (select count(*)::int from public.reviews where session_id = '00000000-0000-0000-0000-000000000806'),
  0, 'sessions を削除すると reviews も連鎖削除される'
);

-- 19. 連鎖削除でもキャッシュは再計算される(0件)
select is(
  (select review_count from public.teller_profiles where profile_id = '00000000-0000-0000-0000-0000000000b2'),
  0, '連鎖削除でも review_count が再計算される'
);

-- 20. 0件のとき平均は NULL
select is(
  (select average_rating from public.teller_profiles where profile_id = '00000000-0000-0000-0000-0000000000b2'),
  null, '評価が0件のとき average_rating は NULL'
);

-- ===== 制約(postgres 権限)=====
-- 21. 自分自身への評価は作れない
select throws_ok(
  $$ insert into public.reviews (session_id, reviewer_id, reviewee_id, rating) values
     ('00000000-0000-0000-0000-000000000807', '00000000-0000-0000-0000-0000000000b2',
      '00000000-0000-0000-0000-0000000000b2', 4) $$,
  '23514', null, '自分自身への評価は作れない'
);

-- 22. rating は NOT NULL
select throws_ok(
  $$ insert into public.reviews (session_id, reviewer_id, reviewee_id, rating) values
     ('00000000-0000-0000-0000-000000000807', '00000000-0000-0000-0000-0000000000c1',
      '00000000-0000-0000-0000-0000000000b2', null) $$,
  '23502', null, 'rating は NULL にできない'
);

select * from finish();
rollback;