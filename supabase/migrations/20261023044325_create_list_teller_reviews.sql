-- list_teller_reviews: 占い師が受けたレビューの公開一覧(占い師詳細画面用)。
-- 依存: public.reviews
--
-- reviews は当事者しか直接読めない(reviews_select_party)ので、公開してよい列だけをこの関数で返す。
-- 誰がどの占い師に相談したかが分からないよう、reviewer_id・session_id は返さない。
-- 並びは新しい順、同じ日時なら id 順。
-- RLS を越えて他人のレビューを読む必要があるので security definer を付ける。

create function public.list_teller_reviews(p_teller_id uuid, p_limit integer)
returns table (
  id         uuid,
  rating     smallint,
  comment    text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select r.id, r.rating, r.comment, r.created_at
  from public.reviews r
  where r.reviewee_id = p_teller_id
  order by r.created_at desc, r.id
  limit p_limit;
$$;

comment on function public.list_teller_reviews(uuid, integer) is
  '占い師が受けたレビューを新しい順に p_limit 件返す。誰が相談したかが分からないよう、reviewer_id・session_id は返さない';

revoke all on function public.list_teller_reviews(uuid, integer) from public, anon, authenticated;
grant execute on function public.list_teller_reviews(uuid, integer) to anon, authenticated;
