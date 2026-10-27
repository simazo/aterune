-- list_favorite_tellers: ログイン中のユーザーがお気に入り登録した占い師の一覧(マイページのお気に入り一覧用)。
-- 依存: public.favorites、public.teller_profiles、public.profiles、public.list_teller_tags_json
--
-- 返す列は search_tellers と同じ(アプリ側で同じカードを使えるように)。
-- 並びはお気に入り登録の新しい順。
-- 受付停止中の占い師も含める(登録したことを覚えておけるように)。
-- 退会したユーザー(profiles.deleted_at あり)は含めない(get_teller が返さず、詳細画面を開けないため)。
-- favorites の行は退会後も残すので、ここで除く。
-- favorites の RLS で自分の行だけになるが、何を返すかが読んで分かるよう where にも書く。
-- 呼び出し元の権限で動けばよいので security definer は付けない。
create function public.list_favorite_tellers()
returns table (
  teller_id       uuid,
  display_name    text,
  avatar_path     text,
  self_pr         text,
  training_period text,
  is_accepting    boolean,
  average_rating  numeric,
  review_count    integer,
  session_count   integer,
  tags            jsonb
)
language sql
stable
set search_path = ''
as $$
  select
    tp.profile_id,
    p.display_name,
    p.avatar_path,
    tp.self_pr,
    tp.training_period,
    tp.is_accepting,
    tp.average_rating,
    tp.review_count,
    tp.session_count,
    public.list_teller_tags_json(tp.profile_id)
  from public.favorites f
  join public.teller_profiles tp on tp.profile_id = f.teller_id
  join public.profiles p on p.id = tp.profile_id
  where f.consultant_id = (select auth.uid())
    and p.deleted_at is null
  order by f.created_at desc, tp.profile_id;
$$;

comment on function public.list_favorite_tellers() is
  'ログイン中のユーザーがお気に入り登録した占い師の一覧。登録の新しい順。受付停止中も含み、退会したユーザーは除く';

revoke all on function public.list_favorite_tellers() from public, anon, authenticated;
grant execute on function public.list_favorite_tellers() to authenticated;
