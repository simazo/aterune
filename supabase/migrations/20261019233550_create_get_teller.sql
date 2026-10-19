-- get_teller: 占い師1人分の詳細(相談者の占い師詳細画面用)。
-- 依存: public.teller_profiles、public.profiles、public.tags、public.teller_tags
--
-- 返す列は search_tellers の1行に、詳細画面で使う requires_birthdate・created_at を足したもの。
-- tags の中身と並び(種類 → 表示順)は search_tellers と同じにする。
-- 同じ SQL を複製しているので、tags の中身・並びを変えるときは search_tellers も合わせて直すこと。
-- 占い師登録の無いユーザーや存在しない ID なら 0 行。
-- 検索と違い、ログイン中のユーザー自身も返す(自分の詳細画面を開けるように)。
-- 呼び出し元の権限で動けばよい(参照先はすべて誰でも読める)ので security definer は付けない。

create function public.get_teller(p_teller_id uuid)
returns table (
  teller_id          uuid,
  display_name       text,
  avatar_url         text,
  self_pr            text,
  training_period    text,
  is_accepting       boolean,
  requires_birthdate boolean,
  average_rating     numeric,
  review_count       integer,
  session_count      integer,
  created_at         timestamptz,
  tags               jsonb
)
language sql
stable
set search_path = ''
as $$
  select
    tp.profile_id,
    p.display_name,
    p.avatar_url,
    tp.self_pr,
    tp.training_period,
    tp.is_accepting,
    tp.requires_birthdate,
    tp.average_rating,
    tp.review_count,
    tp.session_count,
    tp.created_at,
    coalesce(
      (select jsonb_agg(
                jsonb_build_object('slug', t.slug, 'category', t.category, 'name', t.name)
                order by array_position(array['divination', 'concern', 'style'], t.category),
                         t.sort_order, t.name)
         from public.teller_tags tt
         join public.tags t on t.id = tt.tag_id
        where tt.teller_id = tp.profile_id),
      '[]'::jsonb
    )
  from public.teller_profiles tp
  join public.profiles p on p.id = tp.profile_id
  where tp.profile_id = p_teller_id;
$$;

comment on function public.get_teller(uuid) is
  '占い師1人分の詳細。search_tellers の列に requires_birthdate・created_at を加えたもの。占い師でない・存在しない ID なら 0 行';

revoke all on function public.get_teller(uuid) from public, anon, authenticated;
grant execute on function public.get_teller(uuid) to anon, authenticated;
