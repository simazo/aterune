import { supabase } from '@/lib/supabase';
import type { TellerDetail, TellerSearchResult, TellerSortOrder } from '@/types';

type SearchTellersParams = {
  tagSlugs: string[];
  isAcceptingOnly: boolean;
  sort: TellerSortOrder;
};

// 占い師をタグで検索する（同じ種類のタグは OR、種類どうしは AND。ログイン中の自分は除かれる）。
// isAcceptingOnly が true なら受付中の占い師だけ。sort の順に並ぶ。絞り込み・並び順の規則は DB の search_tellers が持つ
export async function searchTellers({ tagSlugs, isAcceptingOnly, sort }: SearchTellersParams) {
  const { data, error } = await supabase.rpc('search_tellers', {
    p_tag_slugs: tagSlugs,
    p_accepting_only: isAcceptingOnly,
    p_sort: sort,
  });

  return { data: data as TellerSearchResult[] | null, error };
}

// 占い師1人分の詳細を取得する（ログイン中の自分も取得できる）。
// 占い師でない・存在しない ID なら data は null
export async function getTeller(tellerId: string) {
  const { data, error } = await supabase
    .rpc('get_teller', { p_teller_id: tellerId })
    .maybeSingle();

  return { data: data as TellerDetail | null, error };
}
