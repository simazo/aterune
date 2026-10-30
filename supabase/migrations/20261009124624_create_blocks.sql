-- blocks: 関わりたくない相手をブロックする。本人の行だけ見える・追加・削除できる。
-- ブロックはブロックした人とされた人の間だけに、どちらの向きでも効く:
--   申込み・お悩みへの応募ができない(check_session_request)、
--   占い師検索・占い師詳細・お悩み一覧・投稿の詳細に相手が出ない(search_tellers・get_teller・
--   list_consultation_posts・get_consultation_post)。
-- 進行中・承認待ちのセッションと過去のやり取りはそのまま残す。ブロックされたことは相手に知らせない。
-- search_tellers などの SQL 関数は作成時に has_block_with が必要なため、それらより前のマイグレーションに置く。
create table public.blocks (
  blocker_id uuid not null references auth.users (id) on delete cascade,
  blocked_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  constraint blocks_not_self_check check (blocker_id <> blocked_id)
);

comment on table  public.blocks            is 'ユーザーのブロック(ブロックした人とされた人の間で、どちらの向きでも申込みと表示を止める)';
comment on column public.blocks.blocker_id is 'ブロックしたユーザーID';
comment on column public.blocks.blocked_id is 'ブロックされたユーザーID';
comment on column public.blocks.created_at is 'ブロックした日時';

-- 主キーは blocker_id 先頭なので、blocked_id 側(逆の向きの判定・ユーザーの削除)用に索引を足す
create index blocks_blocked_id_idx on public.blocks (blocked_id);

alter table public.blocks enable row level security;

revoke all on public.blocks from anon, authenticated;
grant select, insert, delete on public.blocks to authenticated;
grant all                    on public.blocks to service_role;

create policy blocks_select_own
  on public.blocks for select
  to authenticated
  using ((select auth.uid()) = blocker_id);

create policy blocks_insert_own
  on public.blocks for insert
  to authenticated
  with check ((select auth.uid()) = blocker_id);

create policy blocks_delete_own
  on public.blocks for delete
  to authenticated
  using ((select auth.uid()) = blocker_id);

-- ログイン中のユーザーと p_user_id の間に、どちらかの向きのブロックがあるか。未ログインなら false。
-- ブロックされた側は RLS で blocks を読めないため security definer を付ける。
-- 他人同士のブロックの有無を調べられないよう、片方は auth.uid() に固定する
create function public.has_block_with(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.blocks
     where (blocker_id = (select auth.uid()) and blocked_id = p_user_id)
        or (blocker_id = p_user_id and blocked_id = (select auth.uid()))
  );
$$;

comment on function public.has_block_with(uuid) is
  'ログイン中のユーザーと指定したユーザーの間に、どちらかの向きのブロックがあるか。未ログインなら false';

-- 未ログインでも呼ばれる search_tellers・get_teller(呼び出し元の権限で動く)から使うため、anon にも許可する
revoke all on function public.has_block_with(uuid) from public, anon, authenticated;
grant execute on function public.has_block_with(uuid) to anon, authenticated;
