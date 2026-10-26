-- search_tellers: 占い師検索(相談者のさがすタブ用)。
-- 依存: public.teller_profiles、public.profiles、public.tags、public.teller_tags、public.list_teller_tags_json
--
-- タグの絞り込み:
--   ・同じ種類(category)の中は OR、種類どうしは AND
--     例: [タロット, 西洋占星術, 優しく寄り添う] → (タロット or 西洋占星術) and 優しく寄り添う
--   ・存在しない slug は無視する(古い URL などで結果が 0 件にならないように)
--   ・タグ指定なし(空配列)なら全占い師
-- p_accepting_only が true なら受付中(is_accepting)の占い師だけ。false なら受付停止中も含む。
-- p_sort の並び順(同じ値どうしは占い師登録の新しい順):
--   ・newest:   占い師登録の新しい順(既定)
--   ・rating:   レビュー数を加味した評価(ベイズ平均。order by の説明を参照)の高い順。評価がまだ無い占い師は最後
--   ・sessions: 完了セッション数の多い順
-- 結果の tags は、絞り込みに使ったタグだけでなく、その占い師の全タグ。
-- 中身と並びは list_teller_tags_json が決める(get_teller と共通)。
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
  -- 指定していない並び順の case は全員 null になり、順序に影響しない。
  -- 評価順は、レビュー数の少ない占い師の点が大きく振れないよう、ベイズ平均で並べる:
  --   (C × m + 評価の合計) ÷ (C + レビュー数)。評価の合計は average_rating × review_count
  --   (average_rating は小数2桁に丸めた値なので近似。並び順には影響しない程度)。
  --   m(基準の点)= 4.0:件数の少ないうちは全体の平均がぶれやすいため固定値にする。
  --   C(仮のレビュー件数)= 3:駆け出しが中心でレビューが少ないため、数件で本人の平均が反映されるようにする。
  -- レビューが無い占い師は average_rating が null なので、結果も null になり最後に並ぶ。
  -- カードに出す評価は average_rating のまま(並び順にだけ使う)
  order by
    case when p_sort = 'rating'
         then (3 * 4.0 + tp.average_rating * tp.review_count) / (3 + tp.review_count) end desc nulls last,
    case when p_sort = 'sessions' then tp.session_count  end desc nulls last,
    tp.created_at desc,
    tp.profile_id;
$$;

comment on function public.search_tellers(text[], boolean, public.teller_sort_order) is
  '占い師検索。p_tag_slugs のタグで絞り込む(同じ種類の中は OR、種類どうしは AND)。p_accepting_only が true なら受付中のみ。p_sort の順に並べる。ログイン中のユーザー自身は除く';

revoke all on function public.search_tellers(text[], boolean, public.teller_sort_order) from public, anon, authenticated;
grant execute on function public.search_tellers(text[], boolean, public.teller_sort_order) to anon, authenticated;
