-- consultation_posts: 相談者のお悩み投稿(その一覧がお悩み一覧)。
-- status: open(募集中)/ in_progress(対応中。sessions のトリガーが設定)/ closed(本人が閉じた)
-- 投稿者は匿名にするため、利用者には表を直接読ませない(consultant_id から投稿者が分かるため)。
-- 読み取り・閉じる操作は create_consultation_post_functions の関数、応募は apply_to_consultation_post を通す。
create table public.consultation_posts (
  id             uuid primary key default gen_random_uuid(),
  consultant_id  uuid not null references auth.users (id) on delete cascade,
  concern_tag_id uuid not null references public.tags (id),
  concern        text not null,
  status         text not null default 'open'
                 check (status in ('open', 'in_progress', 'closed')),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  -- 応募すると sessions.concern(1000文字まで)にコピーされるので揃える
  constraint consultation_posts_concern_length_check
    check (char_length(concern) <= 1000)
);

comment on table  public.consultation_posts                is '相談者のお悩み投稿';
comment on column public.consultation_posts.id             is '投稿ID';
comment on column public.consultation_posts.consultant_id  is '投稿者(相談者)のユーザーID。匿名にするため利用者には見せない';
comment on column public.consultation_posts.concern_tag_id is '悩みタグのID(tags.category = concern のもの)';
comment on column public.consultation_posts.concern        is '悩みの内容(1000文字まで)';
comment on column public.consultation_posts.status         is '投稿ステータス(open=募集中、in_progress=対応中セッションあり、closed=本人が閉じた)。open / in_progress の切り替えは sessions のトリガーで自動更新、closed は本人が close_consultation_post で設定';

create index consultation_posts_consultant_id_idx  on public.consultation_posts (consultant_id);
create index consultation_posts_concern_tag_id_idx on public.consultation_posts (concern_tag_id);
create index consultation_posts_status_idx         on public.consultation_posts (status);

-- 悩みタグ(category = concern)以外のタグは付けられない。
-- CHECK 制約では tags を見られないためトリガーで確かめる。tags は誰でも読めるので security definer は付けない
create function public.check_post_concern_tag()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_category text;
begin
  select category into v_category
    from public.tags
   where id = new.concern_tag_id;

  -- 存在しないタグは外部キーが弾く
  if found and v_category <> 'concern' then
    raise exception 'the tag is not a concern tag';
  end if;

  return new;
end;
$$;

revoke all on function public.check_post_concern_tag() from public, anon, authenticated;

create trigger consultation_posts_check_concern_tag
  before insert or update of concern_tag_id on public.consultation_posts
  for each row execute function public.check_post_concern_tag();

create trigger consultation_posts_set_updated_at
  before update on public.consultation_posts
  for each row execute function public.set_updated_at();

alter table public.consultation_posts enable row level security;

-- GRANT: 全部外してから最小限だけ付ける。
-- select / update / delete は付けない(読み取りと閉じる操作は関数経由。投稿の編集・削除は今のところできない)
revoke all on public.consultation_posts from anon, authenticated;
grant insert (consultant_id, concern_tag_id, concern) on public.consultation_posts to authenticated;
grant all on public.consultation_posts to service_role;

-- insert: 自分名義のみ(status は列 GRANT により常に open で始まる)
create policy consultation_posts_insert_own
  on public.consultation_posts for insert
  to authenticated
  with check ((select auth.uid()) = consultant_id);
