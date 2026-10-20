import { supabase } from '@/lib/supabase';

// 占い師が受けたレビューを、新しい順に limit 件取得する。
// 誰がどの占い師に相談したかが分からないよう、reviewer_id は取得しない（画面でも匿名で表示する）
export async function listTellerReviews(tellerId: string, limit: number) {
  return supabase
    .from('reviews')
    .select('id, rating, comment, created_at')
    .eq('reviewee_id', tellerId)
    .order('created_at', { ascending: false })
    .order('id')
    .limit(limit);
}
