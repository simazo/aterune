-- apply_to_consultation_post: 占い師がお悩み投稿に応募する(initiated_by = 'teller' のセッションを作る)。
-- 依存: public.consultation_posts、public.profiles、public.sessions
--
-- 投稿者は匿名で、占い師には consultant_id が見えないため、相手(recipient / consultant)は関数の中で投稿から埋める。
-- 投稿を読むため security definer を付け、申し込む側は auth.uid() に固定する。
-- 利用者は sessions に post_id を直接入れられないので、お悩み投稿への応募はこの関数だけでできる。
-- 匿名なのはお悩み一覧・投稿の詳細まで。応募した占い師は、作られたセッションから投稿者が分かる
-- (応募すると相手とのやり取りが始まるため。2026-10-23 に決定)。
-- 次のルールは sessions の制約・トリガーが守る:
--   閉じた投稿には応募できない(check_session_post)、同じ相談者と占い師の間の二重の申込み(check_session_request)、
--   同じ投稿へは1回だけ(sessions_post_id_teller_id_key)、ひとことは100文字まで、
--   悩みタグ・本文のコピー(copy_post_content_to_session)、投稿者への通知(notify_session_request_received)。
-- 作ったセッションの ID を返す。
create function public.apply_to_consultation_post(
  p_post_id           uuid,
  p_applicant_message text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid        uuid := (select auth.uid());
  v_owner      uuid;
  v_session_id uuid;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  select consultant_id into v_owner
    from public.consultation_posts
   where id = p_post_id;

  if not found then
    raise exception 'the post does not exist';
  end if;

  if v_owner = v_uid then
    raise exception 'cannot apply to your own post';
  end if;

  if not exists (
    select 1 from public.profiles
     where id = v_uid
       and is_teller
  ) then
    raise exception 'only tellers can apply to a post';
  end if;

  insert into public.sessions
    (applicant_id, recipient_id, consultant_id, teller_id, initiated_by, post_id, applicant_message)
  values
    (v_uid, v_owner, v_owner, v_uid, 'teller', p_post_id, p_applicant_message)
  returning id into v_session_id;

  return v_session_id;
end;
$$;

comment on function public.apply_to_consultation_post(uuid, text) is
  '占い師がお悩み投稿に応募する。相手は投稿から埋め、作ったセッションの ID を返す';

revoke all on function public.apply_to_consultation_post(uuid, text) from public, anon, authenticated;
grant execute on function public.apply_to_consultation_post(uuid, text) to authenticated;
