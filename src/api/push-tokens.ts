import { logger } from '@/lib/logger';
import { getCurrentPlatform, registerForPushNotificationsAsync } from '@/lib/push-notifications';
import { supabase } from '@/lib/supabase';

// ログイン中のユーザーにpush tokenを紐付けて保存する（ログイン直後・メール確認からの自動ログイン直後に呼ぶ）
// オフラインなどで失敗してもログイン・メール確認の流れを止めないよう、例外は投げない
export async function savePushTokenForCurrentUser() {
  try {
    const token = await registerForPushNotificationsAsync();
    if (!token) return;

    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    if (!userId) return;

    const { error } = await supabase.from('push_tokens').upsert(
      {
        user_id: userId,
        expo_push_token: token,
        platform: getCurrentPlatform(),
      },
      { onConflict: 'user_id,expo_push_token', ignoreDuplicates: true }
    );

    if (error) {
      logger.warn('push_tokens登録エラー:', error.message);
    }
  } catch (e) {
    logger.warn('push token登録中に例外:', e instanceof Error ? e.message : e);
  }
}

// この端末のpush tokenを削除する（RLS上、ログイン中にしか削除できないためログアウト前に呼ぶ）
// オフラインなどで失敗してもログアウトの流れを止めないよう、例外は投げない
export async function deletePushTokenForCurrentDevice() {
  try {
    const token = await registerForPushNotificationsAsync();
    if (!token) return;

    const { error } = await supabase.from('push_tokens').delete().eq('expo_push_token', token);

    if (error) {
      logger.warn('push_tokens削除エラー:', error.message);
    }
  } catch (e) {
    logger.warn('push token削除中に例外:', e instanceof Error ? e.message : e);
  }
}
