-- favorites: 相談者が気に入った占い師を登録する。本人の行だけ見える・追加・削除できる。
create table public.favorites (
  consultant_id uuid not null references auth.users (id) on delete cascade,
  teller_id     uuid not null references public.teller_profiles (profile_id) on delete cascade,
  created_at    timestamptz not null default now(),
  primary key (consultant_id, teller_id)
);

comment on table  public.favorites               is '相談者の占い師お気に入り';
comment on column public.favorites.consultant_id is 'お気に入り登録したユーザーID(相談者)';
comment on column public.favorites.teller_id     is 'お気に入り登録された占い師のユーザーID';

-- 主キーは consultant_id 先頭なので、teller_id 側(占い師の削除・人数集計)用に索引を足す
create index favorites_teller_id_idx on public.favorites (teller_id);

alter table public.favorites enable row level security;

revoke all on public.favorites from anon, authenticated;
grant select, insert, delete on public.favorites to authenticated;
grant all                    on public.favorites to service_role;

create policy "favorites_select_own"
  on public.favorites for select
  to authenticated
  using ((select auth.uid()) = consultant_id);

create policy "favorites_insert_own"
  on public.favorites for insert
  to authenticated
  with check ((select auth.uid()) = consultant_id);

create policy "favorites_delete_own"
  on public.favorites for delete
  to authenticated
  using ((select auth.uid()) = consultant_id);