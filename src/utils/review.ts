import type { SessionDetail } from '@/types';

const DAY_MS = 24 * 60 * 60 * 1000;

// レビューを書ける期間（完了から何日か）。DB の reviews_insert_own（completed_at >= now() - interval '7 days'）と合わせる
const REVIEW_PERIOD_DAYS = 7;

// レビューを書ける期限（完了日時から7日後）
export function getReviewDeadline(completedAt: string) {
  return new Date(new Date(completedAt).getTime() + REVIEW_PERIOD_DAYS * DAY_MS);
}

// 自分がこのセッションのレビューを書けるか（セッション詳細の「レビューを書く」の出し分け）。
// 条件は DB の reviews_insert_own と揃える（相談者・相談者が完了した completed・完了から7日以内）。
// 期限ちょうどは、DB より1瞬早く切れ扱いにして、投稿できないボタンを出さない
export function canWriteReview(
  session: Pick<SessionDetail, 'status' | 'consultant_id' | 'completed_at'>,
  userId: string,
  hasReview: boolean,
  now: Date
) {
  return (
    session.status === 'completed' &&
    session.consultant_id === userId &&
    !hasReview &&
    session.completed_at !== null &&
    getReviewDeadline(session.completed_at) > now
  );
}

// レビューを書ける期限の表示（例：10月30日 12:00まで）。時刻は端末のタイムゾーン
export function formatReviewDeadline(completedAt: string) {
  const deadline = getReviewDeadline(completedAt);
  const hours = String(deadline.getHours()).padStart(2, '0');
  const minutes = String(deadline.getMinutes()).padStart(2, '0');
  return `${deadline.getMonth() + 1}月${deadline.getDate()}日 ${hours}:${minutes}まで`;
}
