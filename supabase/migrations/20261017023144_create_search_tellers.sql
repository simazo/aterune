-- search_tellers: 占い師検索(相談者のさがすタブ用)。
-- 依存: public.teller_profiles、public.profiles、public.tags、public.teller_tags
--
-- タグの絞り込み:
--   ・同じ種類(category)の中は OR、種類どうしは AND
--     例: [タロット, 西洋占星術, 優しく寄り添う] → (タロット or 西洋占星術) and 優しく寄り添う
--   ・存在しない slug は無視する(古い URL などで結果が 0 件にならないように)
--   ・タグ指定なし(空配列)なら全占い師
-- p_accepting_only が true なら受付中(is_accepting)の占い師だけ。false なら受付停止中も含む。
-- p_sort の並び順(同じ値どうしは占い師登録の新しい順):
--   ・newest:   占い師登録の新しい順(既定)
--   ・rating:   平均評価の高い順。評価がまだ無い占い師は最後
--   ・sessions: 完了セッション数の多い順
-- 結果の tags は、絞り込みに使ったタグだけでなく、その占い師の全タグ(種類 → 表示順)。
-- ログイン中のユーザー自身は結果に含めない(未ログインなら auth.uid() が null なので誰も除外しない)。
-- 呼び出し元の権限で動けばよい(参照先はすべて誰でも読める)ので security definer は付けない。

-- 並び順の候補。enum にして、想定外の値は呼び出し時に DB が弾く(型生成で TS 側にもユニオン型が入る)
create type public.teller_sort_order as enum ('newest', 'rating', 'sessions');

comment on type public.teller_sort_order is
  '占い師検索の並び順(newest=新着順、rating=評価順、sessions=完了セッション数順)';

create function public.search_tellers(
  p_tag_slugs      text[]  default '{}',
  p_accepting_only boolean                  default false,
  p_sort           public.teller_sort_order default 'newest'
)
returns table (
  teller_id       uuid,
  display_name    text,
  avatar_url      text,
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
    p.avatar_url,
    tp.self_pr,
    tp.training_period,
    tp.is_accepting,
    tp.average_rating,
    tp.review_count,
    tp.session_count,
    coalesce(
      (select jsonb_agg(
                jsonb_build_object('slug', t.slug, 'category', t.category, 'name', t.name)
                order by t.category, t.sort_order, t.name)
         from public.teller_tags tt
         join public.tags t on t.id = tt.tag_id
        where tt.teller_id = tp.profile_id),
      '[]'::jsonb
    )
  from public.teller_profiles tp
  join public.profiles p on p.id = tp.profile_id
  where tp.profile_id is distinct from (select auth.uid())
    and (not p_accepting_only or tp.is_accepting)
    -- 指定タグの種類のうち、この占い師が満たしていない種類が 1 つも無いこと
    and not exists (
      select t.category
        from public.tags t
       where t.slug = any (p_tag_slugs)
      except
      select t.category
        from public.teller_tags tt
        join public.tags t on t.id = tt.tag_id
       where tt.teller_id = tp.profile_id
         and t.slug = any (p_tag_slugs)
    )
  -- 指定していない並び順の case は全員 null になり、順序に影響しない
  order by
    case when p_sort = 'rating'   then tp.average_rating end desc nulls last,
    case when p_sort = 'sessions' then tp.session_count  end desc nulls last,
    tp.created_at desc,
    tp.profile_id;
$$;

comment on function public.search_tellers(text[], boolean, public.teller_sort_order) is
  '占い師検索。p_tag_slugs のタグで絞り込む(同じ種類の中は OR、種類どうしは AND)。p_accepting_only が true なら受付中のみ。p_sort の順に並べる。ログイン中のユーザー自身は除く';

revoke all on function public.search_tellers(text[], boolean, public.teller_sort_order) from public, anon, authenticated;
grant execute on function public.search_tellers(text[], boolean, public.teller_sort_order) to anon, authenticated;
