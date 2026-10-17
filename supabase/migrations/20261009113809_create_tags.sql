-- tags: タグマスタ(占術・悩み・回答のスタイル)。ユーザーは読み取りのみ、書き込みは service_role / seed のみ。
create table public.tags (
  id         uuid primary key default gen_random_uuid(),
  category   text not null,
  slug       text not null unique,
  name       text not null,
  sort_order integer not null default 0,

  constraint tags_category_check
    check (category in ('divination', 'concern', 'style')),
  -- URL やログで使う識別子。英小文字・数字をハイフンでつないだ形に限る
  constraint tags_slug_check
    check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  -- 表示名は種類の中で一意(種類が違えば同じ名前を使える)
  constraint tags_category_name_key
    unique (category, name)
);

comment on table  public.tags            is 'タグマスタ(占術・悩み・回答のスタイル)';
comment on column public.tags.id         is 'タグID';
comment on column public.tags.category   is 'タグの種類(divination=占術、concern=悩み・相談内容、style=回答のスタイル)';
comment on column public.tags.slug       is 'タグの識別子(URL・seed での参照用。種類をまたいで一意。英小文字・数字・ハイフンのみ)';
comment on column public.tags.name       is 'タグの表示名(種類の中で一意)';
comment on column public.tags.sort_order is '種類の中での表示順(小さいほど先)';

alter table public.tags enable row level security;

-- GRANT: いったん全部外して、必要な分だけ付ける
revoke all on public.tags from anon, authenticated;
grant select on public.tags to anon, authenticated;
grant all    on public.tags to service_role;

-- RLS ポリシー: 誰でも読める
create policy tags_select_public
  on public.tags
  for select
  to anon, authenticated
  using (true);
