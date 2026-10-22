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

// 自分の占い師プロフィール（占い師登録・編集の初期値）を、付いているタグの ID と一緒に取得する。
// 占い師として未登録なら data は null
export async function getMyTellerProfile(userId: string) {
  const { data, error } = await supabase
    .from('teller_profiles')
    .select('self_pr, training_period, requires_birthdate, is_accepting, teller_tags(tag_id)')
    .eq('profile_id', userId)
    .maybeSingle();

  if (!data) return { data: null, error };

  const { teller_tags, ...profile } = data;
  return { data: { ...profile, tag_ids: teller_tags.map((tag) => tag.tag_id) }, error };
}

type SaveTellerProfileParams = {
  selfPr: string;
  trainingPeriod: string;
  requiresBirthdate: boolean;
  isAccepting: boolean;
  tagIds: string[];
};

// 自分の占い師プロフィールを保存する（未登録なら占い師として登録、登録済みなら更新）。
// タグは渡したものに入れ替わる。自己PR・修行期間が空なら null（未入力）で保存する。
// 占術タグが無い・文字数の超過は DB の save_teller_profile と CHECK が弾く
export async function saveTellerProfile({
  selfPr,
  trainingPeriod,
  requiresBirthdate,
  isAccepting,
  tagIds,
}: SaveTellerProfileParams) {
  const { error } = await supabase.rpc('save_teller_profile', {
    // 型生成では関数の引数の NULL 可否が分からず string になるが、DB 側は null（未入力）を受け付ける
    p_self_pr: (selfPr || null) as string,
    p_training_period: (trainingPeriod || null) as string,
    p_requires_birthdate: requiresBirthdate,
    p_is_accepting: isAccepting,
    p_tag_ids: tagIds,
  });

  return { error };
}
