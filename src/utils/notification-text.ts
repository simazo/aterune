import type { NotificationListItem, NotificationType } from '@/types';

// 相手のプロフィールが無いときの表示名（send-push と同じ）
const DELETED_USER_NAME = '退会したユーザー';

// 通知の種類ごとの文言（name は相手の表示名）。
// プッシュ通知の本文（supabase/functions/send-push/index.ts の MESSAGES の body）と揃えるので、変えるときは両方を直す。
// message_received は一覧ではまとめて出すため、getNotificationText で未読の件数に応じた文言に変える
const NOTIFICATION_TEXTS: Record<NotificationType, (name: string) => string> = {
  session_request_received: (name) => `${name}さんからセッションの申込みが届きました`,
  session_request_approved: (name) => `${name}さんとのセッションが始まりました`,
  session_request_rejected: (name) => `${name}さんへの申込みは今回は見送られました`,
  session_completed: (name) => `${name}さんとのセッションが完了しました`,
  review_request: (name) => `${name}さんへのレビューを書いてみませんか`,
  session_auto_completed: (name) => `${name}さんとのセッションが自動で完了しました`,
  message_received: (name) => `${name}さんからメッセージが届きました`,
};

// 通知一覧の1行の文言。まとめたメッセージの行は、未読があれば件数を出す
export function getNotificationText(notification: NotificationListItem) {
  const name = notification.partner_display_name ?? DELETED_USER_NAME;

  if (notification.type === 'message_received' && notification.unread_count > 0) {
    return `${name}さんから ${notification.unread_count} 件のメッセージ`;
  }

  return NOTIFICATION_TEXTS[notification.type](name);
}
