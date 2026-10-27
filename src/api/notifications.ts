import { supabase } from '@/lib/supabase';
import type { NotificationListItem } from '@/types';

// 自分宛ての通知を、新しい順に最大50行取得する（message_received は同じセッションのものが1行にまとまる）
export async function listMyNotifications() {
  const { data, error } = await supabase.rpc('list_my_notifications');

  return { data: data as NotificationListItem[] | null, error };
}

// 未読の件数（ベルのバッジ用）。一覧と同じくまとめた後の行で数える（同じセッションの未読のメッセージは何件でも1と数える）
export async function countUnreadNotifications() {
  return supabase.rpc('count_unread_notifications');
}

// セッションの未読の通知を既読にする（セッション詳細を開いたとき）。
// 自分宛て以外の通知は RLS（notifications_update_own）が更新させないので、受信者では絞らない
export async function markSessionNotificationsRead(sessionId: string) {
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('session_id', sessionId)
    .eq('is_read', false);

  return { error };
}

// 自分宛ての未読の通知をすべて既読にする（通知一覧の「すべて既読にする」）
export async function markAllNotificationsRead(userId: string) {
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('recipient_id', userId)
    .eq('is_read', false);

  return { error };
}
