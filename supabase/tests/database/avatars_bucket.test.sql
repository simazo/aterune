begin;
select plan(11);

-- ---------- 準備 ----------
insert into auth.users (id, aud, role, email) values
  ('00000000-0000-0000-0000-0000000000f1', 'authenticated', 'authenticated', 'f1@example.com'),
  ('00000000-0000-0000-0000-0000000000f2', 'authenticated', 'authenticated', 'f2@example.com');

-- 削除の確認用に、f1・f2 のファイルを postgres 権限で入れておく
insert into storage.objects (bucket_id, name) values
  ('avatars', '00000000-0000-0000-0000-0000000000f1/old.jpg'),
  ('avatars', '00000000-0000-0000-0000-0000000000f2/old.jpg');

-- storage.objects の DELETE は、storage.protect_delete トリガーが Storage API 以外からの削除を弾く。
-- Storage API と同じくこの設定を入れて、ポリシーによる判定だけを確かめる
set local storage.allow_delete_query = 'true';

-- avatars 以外のバケットにはポリシーが効かないことの確認用
insert into storage.buckets (id, name) values ('test-other', 'test-other');

-- ---------- 1. バケットの設定 ----------
select results_eq(
  $$ select public, file_size_limit, allowed_mime_types from storage.buckets where id = 'avatars' $$,
  $$ values (true, 1048576::bigint, array['image/jpeg']::text[]) $$,
  'avatars は公開バケットで、1MB までの JPEG だけを受け付ける'
);

-- ---------- 2-3. anon(未ログイン) ----------
set local role anon;

select throws_ok(
  $$ insert into storage.objects (bucket_id, name)
       values ('avatars', '00000000-0000-0000-0000-0000000000f1/new.jpg') $$,
  '42501',
  null,
  'anon はアップロードできない'
);

select results_eq(
  $$ with d as (
       delete from storage.objects
        where bucket_id = 'avatars' and name = '00000000-0000-0000-0000-0000000000f1/old.jpg'
       returning 1
     ) select count(*)::int from d $$,
  array[0],
  'anon は削除できない(0行)'
);

reset role;

-- ---------- 4-11. authenticated(f1 としてログイン) ----------
set local role authenticated;
set local request.jwt.claims =
  '{"sub":"00000000-0000-0000-0000-0000000000f1","role":"authenticated"}';

select lives_ok(
  $$ insert into storage.objects (bucket_id, name)
       values ('avatars', '00000000-0000-0000-0000-0000000000f1/new.jpg') $$,
  '自分のフォルダへはアップロードできる'
);

select throws_ok(
  $$ insert into storage.objects (bucket_id, name)
       values ('avatars', '00000000-0000-0000-0000-0000000000f2/new.jpg') $$,
  '42501',
  null,
  '他人のフォルダへはアップロードできない'
);

select throws_ok(
  $$ insert into storage.objects (bucket_id, name)
       values ('avatars', 'new.jpg') $$,
  '42501',
  null,
  'フォルダの外(バケット直下)へはアップロードできない'
);

select results_eq(
  $$ select name from storage.objects
      where bucket_id = 'avatars'
        and name in ('00000000-0000-0000-0000-0000000000f1/old.jpg',
                     '00000000-0000-0000-0000-0000000000f2/old.jpg') $$,
  array['00000000-0000-0000-0000-0000000000f1/old.jpg'],
  '自分のフォルダのファイルだけが見え、他人のフォルダのファイルは見えない'
);

select results_eq(
  $$ with d as (
       delete from storage.objects
        where bucket_id = 'avatars' and name = '00000000-0000-0000-0000-0000000000f1/old.jpg'
       returning 1
     ) select count(*)::int from d $$,
  array[1],
  '自分のフォルダのファイルは削除できる'
);

select results_eq(
  $$ with d as (
       delete from storage.objects
        where bucket_id = 'avatars' and name = '00000000-0000-0000-0000-0000000000f2/old.jpg'
       returning 1
     ) select count(*)::int from d $$,
  array[0],
  '他人のフォルダのファイルは削除できない(0行)'
);

select results_eq(
  $$ with u as (
       update storage.objects set name = '00000000-0000-0000-0000-0000000000f1/renamed.jpg'
        where bucket_id = 'avatars' and name = '00000000-0000-0000-0000-0000000000f1/new.jpg'
       returning 1
     ) select count(*)::int from u $$,
  array[0],
  '自分のファイルでも上書き(UPDATE)はできない(0行)'
);

select throws_ok(
  $$ insert into storage.objects (bucket_id, name)
       values ('test-other', '00000000-0000-0000-0000-0000000000f1/new.jpg') $$,
  '42501',
  null,
  'avatars 以外のバケットには、自分のフォルダでもアップロードできない'
);

reset role;

select * from finish();
rollback;
