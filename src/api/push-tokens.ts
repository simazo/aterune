import { logger } from '@/lib/logger';
import {
  getCurrentPlatform,
  getPushTokenIfPermittedAsync,
  registerForPushNotificationsAsync,
} from '@/lib/push-notifications';
import { supabase } from '@/lib/supabase';

// ログイン中のユーザーにpush tokenを紐付けて保存する（ログイン直後・メール確認からの自動ログイン直後に呼ぶ）
// 同じ端末で前にログインしていた別ユーザーの行は、register_push_token が持ち主を付け替える（RLS上、自分では書き換えられないため）
// オフラインなどで失敗してもログイン・メール確認の流れを止めないよう、例外は投げない
export async function savePushTokenForCurrentUser() {
  try {
    const token = await registerForPushNotificationsAsync();
    if (!token) return;

    const { error } = await supabase.rpc('register_push_token', {
      p_token: token,
      p_platform: getCurrentPlatform(),
    });

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
    // 許可を求める関数を使うと、ログアウト時に許可ダイアログが出てしまう
    const token = await getPushTokenIfPermittedAsync();
    if (!token) return;

    const { error } = await supabase.from('push_tokens').delete().eq('expo_push_token', token);

    if (error) {
      logger.warn('push_tokens削除エラー:', error.message);
    }
  } catch (e) {
    logger.warn('push token削除中に例外:', e instanceof Error ? e.message : e);
  }
}
