-- favorites: 相談者が気に入った占い師を登録する。本人の行だけ見える・追加・削除できる。
create table public.favorites (
  consultant_id uuid not null references auth.users (id) on delete cascade,
  teller_id     uuid not null references public.teller_profiles (profile_id) on delete cascade,
  created_at    timestamptz not null default now(),
  primary key (consultant_id, teller_id),
  -- 占い師は相談者にもなれるため、自分自身を登録できないようにする
  constraint favorites_not_self_check check (consultant_id <> teller_id)
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

create policy favorites_select_own
  on public.favorites for select
  to authenticated
  using ((select auth.uid()) = consultant_id);

create policy favorites_insert_own
  on public.favorites for insert
  to authenticated
  with check ((select auth.uid()) = consultant_id);

create policy favorites_delete_own
  on public.favorites for delete
  to authenticated
  using ((select auth.uid()) = consultant_id);

-- 占い師ごとのお気に入りの人数のキャッシュ(teller_profiles.favorite_count)を数え直す。
-- favorites は RLS で本人の行しか読めず、他人の登録を数えられないため、キャッシュとして持つ。
-- 削除でも動かすのは、相談者の退会(auth.users の削除)で連鎖削除された場合も数え直すため。
-- 同時に登録・解除されたとき、互いの変更を見ないまま数えて上書きしないよう、先に行をロックしてから数える。
-- ロックは update と同じ強さ(for no key update)にする。for update だと、favorites の外部キーの確認で
-- かかる for key share とぶつかり、同時に登録した2人が互いを待ってデッドロックになるため。
create function public.update_teller_favorite_count()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_teller uuid := case when tg_op = 'DELETE' then old.teller_id else new.teller_id end;
begin
  perform 1 from public.teller_profiles
   where profile_id = v_teller
     for no key update;

  -- ロックを待ったあとの別の文なので、先に commit された登録・解除も数えられる
  update public.teller_profiles
     set favorite_count = (select count(*) from public.favorites where teller_id = v_teller)
   where profile_id = v_teller;
  return null; -- AFTER トリガーなので戻り値は使われない
end;
$$;

revoke all on function public.update_teller_favorite_count() from public, anon, authenticated;

create trigger favorites_update_teller_favorite_count
  after insert or delete on public.favorites
  for each row execute function public.update_teller_favorite_count();