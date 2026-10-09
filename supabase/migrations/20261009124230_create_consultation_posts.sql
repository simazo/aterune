-- consultation_posts: 相談者が悩みを投稿する掲示板。
-- status: open(募集中)/ in_progress(対応中。sessions のトリガーが設定)/ closed(本人が閉じた)
create table public.consultation_posts (
  id            uuid primary key default gen_random_uuid(),
  consultant_id uuid not null references auth.users (id) on delete cascade,
  category      text,
  concern       text not null,
  status        text not null default 'open'
                check (status in ('open', 'in_progress', 'closed')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

comment on table  public.consultation_posts               is '相談者の悩み投稿(掲示板)';
comment on column public.consultation_posts.id            is '投稿ID';
comment on column public.consultation_posts.consultant_id is '投稿者(相談者)のユーザーID';
comment on column public.consultation_posts.category      is '相談カテゴリ';
comment on column public.consultation_posts.concern       is '悩みの内容';
comment on column public.consultation_posts.status        is '投稿ステータス(open=募集中、in_progress=対応中セッションあり、closed=本人が閉じた)。open / in_progress の切り替えは sessions のトリガーで自動更新、closed は本人が設定';

create index consultation_posts_consultant_id_idx on public.consultation_posts (consultant_id);
create index consultation_posts_status_idx        on public.consultation_posts (status);

create trigger set_updated_at
  before update on public.consultation_posts
  for each row execute function public.set_updated_at();

alter table public.consultation_posts enable row level security;

-- GRANT: 全部外してから最小限だけ付ける
revoke all on public.consultation_posts from anon, authenticated;
grant select on public.consultation_posts to anon, authenticated;
grant insert (consultant_id, category, concern) on public.consultation_posts to authenticated;
grant update (category, concern, status)        on public.consultation_posts to authenticated;
grant delete on public.consultation_posts to authenticated;
grant all    on public.consultation_posts to service_role;

-- select: 閉じた投稿は本人以外に見えない
create policy "consultation_posts_select_anon"
  on public.consultation_posts for select
  to anon
  using (status <> 'closed');

create policy "consultation_posts_select_authenticated"
  on public.consultation_posts for select
  to authenticated
  using (status <> 'closed' or (select auth.uid()) = consultant_id);

-- insert: 自分名義のみ(status は列 GRANT により常に open で始まる)
create policy "consultation_posts_insert_own"
  on public.consultation_posts for insert
  to authenticated
  with check ((select auth.uid()) = consultant_id);

-- update: 自分の投稿のみ。本人が設定できる status は open / closed だけ
create policy "consultation_posts_update_own"
  on public.consultation_posts for update
  to authenticated
  using ((select auth.uid()) = consultant_id)
  with check (
    (select auth.uid()) = consultant_id
    and status in ('open', 'closed')
  );

create policy "consultation_posts_delete_own"
  on public.consultation_posts for delete
  to authenticated
  using ((select auth.uid()) = consultant_id);