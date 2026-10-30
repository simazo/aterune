-- お悩み投稿の読み取りと、本人が閉じる操作。
-- 依存: public.consultation_posts、public.tags、public.sessions
--
-- 投稿者を匿名にするため、利用者には consultation_posts を直接読ませず、consultant_id を除いた列をこの関数で返す。
-- consultant_id(自分の投稿か)と sessions(他人との応募も含む)を読むため security definer を付け、
-- 呼び出し元は auth.uid() で絞る。
-- お悩み一覧・投稿の詳細には、ログイン中のユーザーとの間にどちらかの向きのブロックがある相手の投稿を出さない(has_block_with)。

-- お悩み一覧: 募集中・対応中の投稿を新着順に返す(閉じた投稿は本人のものも返さない)。
--   is_mine     : ログイン中のユーザー自身の投稿か(応募ボタンを出さないため)
--   has_applied : ログイン中のユーザーが占い師として応募済みか(拒否・期限切れも含む。再応募はできないため)
create function public.list_consultation_posts()
returns table (
  id               uuid,
  concern_tag_id   uuid,
  concern_tag_name text,
  concern          text,
  status           text,
  created_at       timestamptz,
  is_mine          boolean,
  has_applied      boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    cp.id,
    cp.concern_tag_id,
    t.name,
    cp.concern,
    cp.status,
    cp.created_at,
    cp.consultant_id = (select auth.uid()),
    exists (
      select 1 from public.sessions s
       where s.post_id = cp.id
         and s.teller_id = (select auth.uid())
    )
  from public.consultation_posts cp
  join public.tags t on t.id = cp.concern_tag_id
  where cp.status in ('open', 'in_progress')
    and not public.has_block_with(cp.consultant_id)
  order by cp.created_at desc, cp.id;
$$;

comment on function public.list_consultation_posts() is
  'お悩み一覧。募集中・対応中の投稿を新着順に返す。投稿者を匿名にするため consultant_id は返さない';

-- お悩み投稿1件(投稿の詳細画面用)。列は list_consultation_posts と同じ。
-- 閉じた投稿は本人にだけ返す。見られない・ブロックのある相手の・存在しない ID なら 0 行
create function public.get_consultation_post(p_post_id uuid)
returns table (
  id               uuid,
  concern_tag_id   uuid,
  concern_tag_name text,
  concern          text,
  status           text,
  created_at       timestamptz,
  is_mine          boolean,
  has_applied      boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    cp.id,
    cp.concern_tag_id,
    t.name,
    cp.concern,
    cp.status,
    cp.created_at,
    cp.consultant_id = (select auth.uid()),
    exists (
      select 1 from public.sessions s
       where s.post_id = cp.id
         and s.teller_id = (select auth.uid())
    )
  from public.consultation_posts cp
  join public.tags t on t.id = cp.concern_tag_id
  where cp.id = p_post_id
    and (cp.status <> 'closed' or cp.consultant_id = (select auth.uid()))
    and not public.has_block_with(cp.consultant_id);
$$;

comment on function public.get_consultation_post(uuid) is
  'お悩み投稿1件。列は list_consultation_posts と同じ。閉じた投稿は本人にだけ返す';

-- 自分のお悩み投稿: 閉じたものも含めて新着順に返す
create function public.list_my_consultation_posts()
returns table (
  id               uuid,
  concern_tag_id   uuid,
  concern_tag_name text,
  concern          text,
  status           text,
  created_at       timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    cp.id,
    cp.concern_tag_id,
    t.name,
    cp.concern,
    cp.status,
    cp.created_at
  from public.consultation_posts cp
  join public.tags t on t.id = cp.concern_tag_id
  where cp.consultant_id = (select auth.uid())
  order by cp.created_at desc, cp.id;
$$;

comment on function public.list_my_consultation_posts() is
  'ログイン中のユーザーのお悩み投稿。閉じたものも含めて新着順に返す';

-- 本人が投稿を閉じる。閉じたあとは応募できなくなるが、進行中のセッションはそのまま続く。
-- 閉じた投稿をもう一度閉じてもエラーにしない(二度押しなど)。再開はできない
create function public.close_consultation_post(p_post_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid;
begin
  select consultant_id into v_owner
    from public.consultation_posts
   where id = p_post_id
   for update;

  if v_owner is distinct from (select auth.uid()) then
    raise exception 'only the owner can close the post';
  end if;

  update public.consultation_posts
     set status = 'closed'
   where id = p_post_id
     and status <> 'closed';
end;
$$;

comment on function public.close_consultation_post(uuid) is
  '本人がお悩み投稿を閉じる。閉じたあとは応募できない(進行中のセッションは続く)';

revoke all on function public.list_consultation_posts()          from public, anon, authenticated;
revoke all on function public.get_consultation_post(uuid)        from public, anon, authenticated;
revoke all on function public.list_my_consultation_posts()       from public, anon, authenticated;
revoke all on function public.close_consultation_post(uuid)      from public, anon, authenticated;
grant execute on function public.list_consultation_posts()       to authenticated;
grant execute on function public.get_consultation_post(uuid)     to authenticated;
grant execute on function public.list_my_consultation_posts()    to authenticated;
grant execute on function public.close_consultation_post(uuid)   to authenticated;
