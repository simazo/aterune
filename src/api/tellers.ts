import { supabase } from '@/lib/supabase';
import type { TellerSearchResult } from '@/types';

type SearchTellersParams = {
  tagSlugs: string[];
  isAcceptingOnly: boolean;
};

// 占い師をタグで検索する（同じ種類のタグは OR、種類どうしは AND。ログイン中の自分は除かれる）。
// isAcceptingOnly が true なら受付中の占い師だけ。絞り込みの規則は DB の search_tellers が持つ
export async function searchTellers({ tagSlugs, isAcceptingOnly }: SearchTellersParams) {
  const { data, error } = await supabase.rpc('search_tellers', {
    p_tag_slugs: tagSlugs,
    p_accepting_only: isAcceptingOnly,
  });

  return { data: data as TellerSearchResult[] | null, error };
}
