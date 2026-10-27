import { countUnreadNotifications } from '@/api/notifications';
import { Badge, BadgeText } from '@/components/ui/badge';
import { BellIcon, Icon } from '@/components/ui/icon';
import { Pressable } from '@/components/ui/pressable';
import { logger } from '@/lib/logger';
import { subscribeToReceivedNotifications } from '@/lib/push-notifications';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

// バッジに出す件数の上限（これを超えたら「99+」）
const MAX_BADGE_COUNT = 99;

// タブのヘッダー右上のベル。未読の通知の件数をバッジで出し、タップで通知一覧を開く。
// 件数は、画面が表示されたとき・アプリが前面に戻ったとき・前面でプッシュを受け取ったときに読み直す。
// ベルはタブごとにあるため、前面に戻ったとき・受け取ったときは、表示中のタブのベルだけが読み直す
export function NotificationBell() {
  const router = useRouter();
  const [count, setCount] = useState(0);
  const isFocusedRef = useRef(false);

  // 読めなかったときはヘッダーの部品なのでトーストは出さず、前の件数を残す
  const refresh = useCallback(async () => {
    const { data, error } = await countUnreadNotifications();
    if (error || data === null) {
      logger.warn('未読の通知の件数の取得エラー:', error?.message);
      return;
    }
    setCount(data);
  }, []);

  useFocusEffect(
    useCallback(() => {
      isFocusedRef.current = true;
      refresh();
      return () => {
        isFocusedRef.current = false;
      };
    }, [refresh])
  );

  useEffect(() => {
    const appStateSubscription = AppState.addEventListener('change', (state) => {
      if (state === 'active' && isFocusedRef.current) refresh();
    });
    const unsubscribeReceived = subscribeToReceivedNotifications(() => {
      if (isFocusedRef.current) refresh();
    });

    return () => {
      appStateSubscription.remove();
      unsubscribeReceived();
    };
  }, [refresh]);

  function handlePress() {
    router.push('/notifications');
  }

  return (
    <Pressable
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={count > 0 ? `通知（未読 ${count} 件）` : '通知'}
      className="mr-4 p-1 data-[active=true]:opacity-60"
    >
      <Icon as={BellIcon} size="xl" className="text-foreground" />
      {count > 0 && (
        <Badge className="absolute -right-2 -top-1 min-w-5 rounded-full px-1">
          <BadgeText>{count > MAX_BADGE_COUNT ? `${MAX_BADGE_COUNT}+` : count}</BadgeText>
        </Badge>
      )}
    </Pressable>
  );
}
