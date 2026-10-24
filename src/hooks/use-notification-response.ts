import { logger } from '@/lib/logger';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';

// プッシュ通知がタップされたら、紐づくセッションの詳細を開く（ログイン後のレイアウトで、ログイン中のユーザーIDを渡して呼ぶ）
// 通知の data には send-push（Edge Function）が session_id と recipient_id を入れる。URL は受け取らず、ここで組み立てる
// 未ログインの間にタップされた通知は、記録を残しておき、ログインしたときに開く
export function useNotificationResponse(userId: string | undefined) {
  // 起動のきっかけのタップは、記録の読み取りとリスナーの両方から届くことがあるため、処理した通知を覚えておく
  const handledIdRef = useRef<string | null>(null);

  useEffect(() => {
    // Web 版はプッシュ通知を受け取らない（push token を登録していない）
    if (Platform.OS === 'web' || !userId) return;

    let isActive = true;

    function handleResponse(response: Notifications.NotificationResponse) {
      const notificationId = response.notification.request.identifier;
      if (handledIdRef.current === notificationId) return;
      handledIdRef.current = notificationId;

      // 開くかどうかに関わらず記録を消し、ログインし直したときなどに同じタップでもう一度開かないようにする
      Notifications.clearLastNotificationResponseAsync().catch((e) => {
        logger.warn('通知のタップの記録を消す処理で例外:', e instanceof Error ? e.message : e);
      });

      if (response.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return;

      const data = response.notification.request.content.data;
      const sessionId = data?.session_id;
      if (typeof sessionId !== 'string') return;
      // 前にログインしていた別のアカウント宛ての通知は開かない
      if (data?.recipient_id !== userId) return;

      router.push({ pathname: '/sessions/[id]', params: { id: sessionId } });
    }

    // アプリが閉じていたときや、未ログインの間にされたタップ
    Notifications.getLastNotificationResponseAsync()
      .then((response) => {
        if (response && isActive) handleResponse(response);
      })
      .catch((e) => {
        logger.warn('通知のタップの記録を読む処理で例外:', e instanceof Error ? e.message : e);
      });

    // ログイン中にアプリを開いている間（バックグラウンドを含む）のタップ
    const subscription = Notifications.addNotificationResponseReceivedListener(handleResponse);

    return () => {
      isActive = false;
      subscription.remove();
    };
  }, [userId]);
}
