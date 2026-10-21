-- ============================================================
-- profiles: ユーザーの公開プロフィール(auth.users と 1:1)
-- 依存: public.set_updated_at()(別マイグレーション)
-- ============================================================

-- 1. テーブル作成 -------------------------------------------
create table public.profiles (
  id           uuid primary key
               references auth.users (id) on delete cascade,
  display_name text not null,
  avatar_url   text,
  bio          text,
  is_teller    boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

comment on table  public.profiles is 'ユーザーの公開プロフィール';
comment on column public.profiles.id is 'ユーザーID(auth.usersと1:1)';
comment on column public.profiles.display_name is '表示名';
comment on column public.profiles.avatar_url is 'アバター画像URL';
comment on column public.profiles.bio is '自己紹介文(一般ユーザー向け)';
comment on column public.profiles.is_teller is '占い師登録の有無(teller_profilesの作成/削除時にトリガーで自動同期。手動更新しない)';

-- 2. updated_at の自動更新 ----------------------------------
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- 3. RLS を有効化 --------------------------------------------
alter table public.profiles enable row level security;

-- 4. ポリシー ------------------------------------------------
create policy profiles_select_public
  on public.profiles for select
  to anon, authenticated
  using (true);

create policy profiles_insert_own
  on public.profiles for insert
  to authenticated
  with check ((select auth.uid()) = id);

create policy profiles_update_own
  on public.profiles for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- 5. GRANT ---------------------------------------------------
revoke all on public.profiles from anon, authenticated;

grant select on public.profiles to anon;
grant select on public.profiles to authenticated;

-- is_teller は自分で書き換えさせないよう、列を限定して許可する
grant insert (id, display_name, avatar_url, bio)
  on public.profiles to authenticated;
grant update (display_name, avatar_url, bio)
  on public.profiles to authenticated;

grant all on public.profiles to service_role;