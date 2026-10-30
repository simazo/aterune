-- list_blocked_users: ログイン中のユーザーがブロックした相手の一覧(マイページのブロック中の相談者・占い師の一覧用)。
-- 依存: public.blocks、public.profiles
--
-- blocks の外部キーは auth.users を指していて profiles と結合できないため、表示名・アイコンをこの関数で一緒に返す。
-- 並びはブロックの新しい順。
-- 退会したユーザー(profiles.deleted_at あり)は含めない(解除しても意味がないため)。
-- blocks の行は auth.users の削除で連鎖削除される。
-- 自分をブロックした相手は含めない(ブロックされたことは相手に知らせないため)。
-- blocks の RLS で自分の行だけになるが、何を返すかが読んで分かるよう where にも書く。
-- 呼び出し元の権限で動けばよい(profiles は誰でも読める)ので security definer は付けない。
create function public.list_blocked_users()
returns table (
  blocked_id   uuid,
  display_name text,
  avatar_path  text,
  created_at   timestamptz
)
language sql
stable
set search_path = ''
as $$
  select
    b.blocked_id,
    p.display_name,
    p.avatar_path,
    b.created_at
  from public.blocks b
  join public.profiles p on p.id = b.blocked_id
  where b.blocker_id = (select auth.uid())
    and p.deleted_at is null
  order by b.created_at desc, b.blocked_id;
$$;

comment on function public.list_blocked_users() is
  'ログイン中のユーザーがブロックした相手の一覧。ブロックの新しい順。退会したユーザーは除く';

revoke all on function public.list_blocked_users() from public, anon, authenticated;
grant execute on function public.list_blocked_users() to authenticated;
