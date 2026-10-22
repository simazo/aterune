import type { PostgrestError } from '@supabase/supabase-js';

// レビューの投稿（reviews への insert）が失敗したときの、エラーコード（error.code）ごとの日本語の文言。
// 23505 は UNIQUE 制約（1セッション1回）、42501 は RLS（reviews_insert_own）の違反。
// RLS は相談者以外・completed 以外でも弾くが、画面ではそれらのときボタンを出さないため、残るのは期間切れになる
const REVIEW_ERROR_MESSAGES: Record<string, string> = {
  '23505': 'このやり取りにはすでにレビューを投稿しています',
  '42501': 'レビューを書ける期間が過ぎています',
};

// 分からないエラーや、通信エラーなどの場合の文言
const FALLBACK_REVIEW_ERROR_MESSAGE =
  'レビューを投稿できませんでした。時間をおいて、もう一度お試しください';

export function getReviewErrorMessage(error: Pick<PostgrestError, 'code' | 'message'>) {
  return REVIEW_ERROR_MESSAGES[error.code] ?? FALLBACK_REVIEW_ERROR_MESSAGE;
}
