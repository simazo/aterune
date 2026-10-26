-- prepare_account_deletion: 退会の DB 側の処理をまとめて行う(Edge Function delete-account から呼ぶ)。
-- 依存: public.sessions、public.consultation_posts、public.profiles、public.profile_private_details、public.push_tokens
--
-- 退会は論理削除にする。セッション・メッセージ・レビュー・通知・占い師プロフィールは、相手側の記録として残す。
-- 処理:
--   1. 承認待ちのセッション(申し込んだもの・申し込まれたものの両方)を expired にする(相手への通知はしない)
--   2. 進行中のセッションが残っていれば例外にして、すべて取り消す
--   3. お悩み投稿を閉じる
--   4. プロフィールの表示名を「退会したユーザー」にし、自己紹介・アイコンを空にして deleted_at を入れる
--      (表示名は CHECK 制約で空にできないため、固定の文言を入れる。表示側はそのまま「退会したユーザー」と出る)
--   5. 生年月日・性別(profile_private_details)と push token を削除する
-- 1 を 2 より先に行うのは、確かめた直後に別の操作で承認されて、進行中のセッションが残るのを防ぐため
-- (1 で行をロックするので、同時の承認は 1 のあとに待たされて失敗するか、先に承認されて 2 で例外になる)。
-- 1 のあと、この関数がコミットするまでの間に作られた申込みは、deleted_at がまだ見えないため防げない。
-- そうして残った pending は、定期処理で期限切れになる(退会したユーザーはログインできないので承認もされない)。
-- このあと Edge Function が auth のユーザーを論理削除する。そこで失敗しても退会し直せるよう、何度呼んでも同じ結果になる。
-- expired への遷移は guard_session_status_change がシステム(auth.uid() が null)にだけ許しているので、
-- service_role からだけ呼ぶ。service_role は RLS を越えられるので security definer は付けない。
create function public.prepare_account_deletion(p_user_id uuid)
returns void
language plpgsql
set search_path = ''
as $$
begin
  update public.sessions
     set status = 'expired'
   where status = 'pending'
     and p_user_id in (applicant_id, recipient_id);

  if exists (
    select 1 from public.sessions
     where status = 'active'
       and p_user_id in (applicant_id, recipient_id)
  ) then
    raise exception 'the user has an active session';
  end if;

  -- 進行中のセッションが無いので、対応中(in_progress)の投稿は残っていない
  update public.consultation_posts
     set status = 'closed'
   where consultant_id = p_user_id
     and status <> 'closed';

  update public.profiles
     set display_name = '退会したユーザー',
         bio          = null,
         avatar_url   = null,
         deleted_at   = coalesce(deleted_at, now())
   where id = p_user_id;

  delete from public.profile_private_details where profile_id = p_user_id;
  delete from public.push_tokens where user_id = p_user_id;
end;
$$;

comment on function public.prepare_account_deletion(uuid) is
  '退会の DB 側の処理(承認待ちの期限切れ・投稿を閉じる・プロフィールの書き換え・非公開情報と push token の削除)。進行中のセッションがあれば例外。service_role 専用';

revoke all on function public.prepare_account_deletion(uuid) from public, anon, authenticated;
grant execute on function public.prepare_account_deletion(uuid) to service_role;
