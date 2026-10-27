import { supabase } from '@/lib/supabase';
import type { TellerSearchResult } from '@/types';

// 主キー（consultant_id, teller_id）の重複。すでに登録済みのとき
const UNIQUE_VIOLATION = '23505';

// 自分がその占い師をお気に入り登録しているかを取得する
export async function isFavoriteTeller(userId: string, tellerId: string) {
  const { data, error } = await supabase
    .from('favorites')
    .select('teller_id')
    .eq('consultant_id', userId)
    .eq('teller_id', tellerId)
    .maybeSingle();

  return { data: data !== null, error };
}

// 占い師をお気に入りに登録する。
// 登録済み（二度押し・別端末での登録）なら、目的の状態にはなっているので成功として返す
export async function addFavorite(userId: string, tellerId: string) {
  const { error } = await supabase
    .from('favorites')
    .insert({ consultant_id: userId, teller_id: tellerId });

  if (error?.code === UNIQUE_VIOLATION) return { error: null };
  return { error };
}

// 占い師をお気に入りから外す。
// 登録が無く 0 件の削除になっても（二度押し・別端末での解除）エラーにはならず、成功として返る
export async function removeFavorite(userId: string, tellerId: string) {
  const { error } = await supabase
    .from('favorites')
    .delete()
    .eq('consultant_id', userId)
    .eq('teller_id', tellerId);

  return { error };
}

// 自分がお気に入り登録した占い師の一覧を、登録の新しい順に取得する（受付停止中も含み、退会した占い師は除かれる）。
// 列は search_tellers と同じなので TellerSearchResult として返す（NULL になりうる列の型も同じ理由で上書きする）
export async function listFavoriteTellers() {
  const { data, error } = await supabase.rpc('list_favorite_tellers');

  return { data: data as TellerSearchResult[] | null, error };
}
