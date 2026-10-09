-- tags: 占術の種類マスタ。ユーザーは読み取りのみ、書き込みは service_role / seed のみ。
create table public.tags (
  id   uuid primary key default gen_random_uuid(),
  name text not null unique
);

comment on table  public.tags      is '占術の種類マスタ';
comment on column public.tags.id   is 'タグID';
comment on column public.tags.name is 'タグ名(占術の種類)';

alter table public.tags enable row level security;

-- GRANT: いったん全部外して、必要な分だけ付ける
revoke all on public.tags from anon, authenticated;
grant select on public.tags to anon, authenticated;
grant all    on public.tags to service_role;

-- RLS ポリシー: 誰でも読める
create policy "tags_select_public"
  on public.tags
  for select
  to anon, authenticated
  using (true);