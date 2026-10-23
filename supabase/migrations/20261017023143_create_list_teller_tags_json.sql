-- list_teller_tags_json: 占い師1人分のタグを、画面に出す形の jsonb の配列で返す。
-- 依存: public.teller_tags、public.tags
--
-- search_tellers と get_teller の両方で使い、さがすタブと占い師詳細でタグの中身・並びを揃える。
-- そのため、search_tellers より前に作られるよう、ファイル名の日時を search_tellers の直前にしている。
-- 中身は { slug, category, name } の配列。並びは種類(enum tag_category の順番＝占術 → 悩み → 回答のスタイル)
-- → 表示順(sort_order)→ 名前。タグが無い(占い師でない・存在しない ID を含む)なら空配列。
-- 呼び出し元の権限で動けばよい(参照先はすべて誰でも読める)ので security definer は付けない。

create function public.list_teller_tags_json(p_teller_id uuid)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select coalesce(
    (select jsonb_agg(
              jsonb_build_object('slug', t.slug, 'category', t.category, 'name', t.name)
              order by t.category, t.sort_order, t.name)
       from public.teller_tags tt
       join public.tags t on t.id = tt.tag_id
      where tt.teller_id = p_teller_id),
    '[]'::jsonb
  );
$$;

comment on function public.list_teller_tags_json(uuid) is
  '占い師1人分のタグを { slug, category, name } の配列(種類 → 表示順 → 名前の順)で返す。タグが無ければ空配列';

-- search_tellers・get_teller は呼び出し元の権限で動くため、anon・authenticated に実行権限を付ける
revoke all on function public.list_teller_tags_json(uuid) from public, anon, authenticated;
grant execute on function public.list_teller_tags_json(uuid) to anon, authenticated;
