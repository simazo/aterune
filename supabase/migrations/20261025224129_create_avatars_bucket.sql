-- ============================================================
-- avatars: アイコン画像を置く Storage のバケット
-- 依存: なし(パスは public.profiles.avatar_path に保存する)
--
-- ファイルは <ユーザーの id>/<ファイル名>.jpg に置く。
-- アイコンは profiles と同じく誰でも読める公開情報なので公開バケットにし、getPublicUrl の URL をそのまま表示に使う
-- (公開 URL での読み取りはポリシーを通らない)。
-- SELECT のポリシーは削除のためだけに自分のフォルダに限って付ける(WHERE 付きの DELETE は SELECT のポリシーでも
-- 見える行しか対象にしないため)。全員に許可すると、list で全ユーザーの id とファイルの一覧が取れてしまう。
-- 端末の画像キャッシュに古い画像が残らないよう、アップロードのたびに新しいファイル名にするので、
-- 上書き(UPDATE)のポリシーも付けない。
--
-- storage スキーマは Supabase が管理しているため、db reset --linked で行やポリシーが残っていても
-- 当て直せるよう、バケットは on conflict で更新し、ポリシーは消してから作る
-- ============================================================

-- 1. バケット ------------------------------------------------
-- 512px に縮小した JPEG を上げるので、1MB あれば足りる
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 1048576, array['image/jpeg'])
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- 2. ポリシー ------------------------------------------------
-- 最初のフォルダが自分の id のときだけ、見る(削除の対象にする)・アップロード・削除ができる
drop policy if exists avatars_select_own on storage.objects;
create policy avatars_select_own
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists avatars_insert_own on storage.objects;
create policy avatars_insert_own
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists avatars_delete_own on storage.objects;
create policy avatars_delete_own
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
