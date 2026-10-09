-- teller_tags: 占い師と占術タグの多対多。自分の行だけ追加・削除できる。
create table public.teller_tags (
  teller_id uuid not null references public.teller_profiles (profile_id) on delete cascade,
  tag_id    uuid not null references public.tags (id) on delete cascade,
  primary key (teller_id, tag_id)
);

comment on table  public.teller_tags           is '占い師と占術タグの関連';
comment on column public.teller_tags.teller_id is '占い師のユーザーID';
comment on column public.teller_tags.tag_id    is 'タグID';

-- 主キーは (teller_id, tag_id) なので teller_id 側の検索は効く。tag_id 側の検索(タグで絞り込み)用に索引を足す
create index teller_tags_tag_id_idx on public.teller_tags (tag_id);

alter table public.teller_tags enable row level security;

revoke all on public.teller_tags from anon, authenticated;
grant select         on public.teller_tags to anon, authenticated;
grant insert, delete on public.teller_tags to authenticated;
grant all            on public.teller_tags to service_role;

create policy "teller_tags_select_public"
  on public.teller_tags for select
  to anon, authenticated
  using (true);

create policy "teller_tags_insert_own"
  on public.teller_tags for insert
  to authenticated
  with check ((select auth.uid()) = teller_id);

create policy "teller_tags_delete_own"
  on public.teller_tags for delete
  to authenticated
  using ((select auth.uid()) = teller_id);