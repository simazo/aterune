import { supabase } from '@/lib/supabase';
import type { TellerSearchResult } from '@/types';

// 占い師をタグで検索する（同じ種類のタグは OR、種類どうしは AND。ログイン中の自分は除かれる）。
// 絞り込みの規則は DB の search_tellers が持つ
export async function searchTellers(tagSlugs: string[]) {
  const { data, error } = await supabase.rpc('search_tellers', { p_tag_slugs: tagSlugs });

  return { data: data as TellerSearchResult[] | null, error };
}
