import { supabase } from '@/lib/supabase';

type CreateReviewParams = {
  sessionId: string;
  reviewerId: string;
  revieweeId: string;
  rating: number;
  comment: string;
};

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

// セッションに付いたレビューを取得する（セッション詳細で、相談者・占い師の両方に見せる）。まだ無ければ data は null
export async function getSessionReview(sessionId: string) {
  return supabase
    .from('reviews')
    .select('id, rating, comment, created_at')
    .eq('session_id', sessionId)
    .maybeSingle();
}

// 自分（相談者）名義で、セッションの占い師へのレビューを登録する。コメントが空なら null で保存する。
// 相談者以外・完了（completed）でない・完了から7日を過ぎた投稿は RLS（reviews_insert_own）が、
// 2回目の投稿は UNIQUE 制約が、評価の範囲外・コメントの文字数の超過は CHECK が弾く
export async function createReview({
  sessionId,
  reviewerId,
  revieweeId,
  rating,
  comment,
}: CreateReviewParams) {
  const { error } = await supabase.from('reviews').insert({
    session_id: sessionId,
    reviewer_id: reviewerId,
    reviewee_id: revieweeId,
    rating,
    comment: comment || null,
  });

  return { error };
}
