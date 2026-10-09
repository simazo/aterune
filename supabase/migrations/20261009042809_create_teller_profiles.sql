-- ============================================================
-- teller_profiles: 占い師専用のプロフィール(profiles と 1:1、占い師のみ行が存在)
-- 依存: public.profiles、public.set_updated_at()
-- ============================================================

-- 1. テーブル作成 -------------------------------------------
create table public.teller_profiles (
  profile_id         uuid primary key
                     references public.profiles (id) on delete cascade,
  self_pr            text,
  is_accepting       boolean not null default true,
  requires_birthdate boolean not null default false,
  average_rating     numeric(3, 2),
  review_count       integer not null default 0,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

comment on table  public.teller_profiles is '占い師専用のプロフィール(占い師のみ行が存在)';
comment on column public.teller_profiles.profile_id is '対象ユーザーID(profilesと1:1、占い師のみ行が存在)';
comment on column public.teller_profiles.self_pr is '占い師専用の自己PR文(経歴・得意な占術・鑑定スタイル等の長文を想定。profiles.bioとは別カラム)';
comment on column public.teller_profiles.is_accepting is '受付ステータス(true=新規セッション受付中)';
comment on column public.teller_profiles.requires_birthdate is 'セッション申込み時に相談者の生年月日入力を必須にするか';
comment on column public.teller_profiles.average_rating is '平均評価(reviews投稿時にトリガーで自動更新されるキャッシュ値。手動更新しない)';
comment on column public.teller_profiles.review_count is '評価件数(reviews投稿時にトリガーで自動更新されるキャッシュ値。手動更新しない)';

-- 2. updated_at の自動更新 ----------------------------------
create trigger teller_profiles_set_updated_at
  before update on public.teller_profiles
  for each row execute function public.set_updated_at();

-- 3. profiles.is_teller / active_mode の同期 ----------------
create function public.sync_is_teller()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    update public.profiles
      set is_teller = true
      where id = new.profile_id;
  elsif tg_op = 'DELETE' then
    -- 占い師でなくなるので、モードも相談者に戻す
    -- (1つの update で両方変えないと、CHECK 制約に違反する)
    update public.profiles
      set is_teller = false,
          active_mode = 'consultant'
      where id = old.profile_id;
  end if;
  return coalesce(new, old);
end;
$$;

revoke all on function public.sync_is_teller() from public, anon, authenticated;

create trigger teller_profiles_sync_is_teller
  after insert or delete on public.teller_profiles
  for each row execute function public.sync_is_teller();

-- 4. RLS を有効化 --------------------------------------------
alter table public.teller_profiles enable row level security;

-- 5. ポリシー ------------------------------------------------
create policy teller_profiles_select_public
  on public.teller_profiles for select
  to anon, authenticated
  using (true);

create policy teller_profiles_insert_own
  on public.teller_profiles for insert
  to authenticated
  with check ((select auth.uid()) = profile_id);

create policy teller_profiles_update_own
  on public.teller_profiles for update
  to authenticated
  using ((select auth.uid()) = profile_id)
  with check ((select auth.uid()) = profile_id);

-- 6. GRANT ---------------------------------------------------
revoke all on public.teller_profiles from anon, authenticated;

grant select on public.teller_profiles to anon;
grant select on public.teller_profiles to authenticated;

-- average_rating / review_count は自分で書き換えさせない(列を限定)
grant insert (profile_id, self_pr, is_accepting, requires_birthdate)
  on public.teller_profiles to authenticated;
grant update (self_pr, is_accepting, requires_birthdate)
  on public.teller_profiles to authenticated;

grant all on public.teller_profiles to service_role;