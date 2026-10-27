import { getAvatarUrl } from '@/api/avatars';
import { listMyNotifications, markAllNotificationsRead } from '@/api/notifications';
import { Avatar, AvatarFallbackText, AvatarImage } from '@/components/ui/avatar';
import { Button, ButtonSpinner, ButtonText } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { HStack } from '@/components/ui/hstack';
import { Pressable } from '@/components/ui/pressable';
import { ScrollView } from '@/components/ui/scroll-view';
import { Spinner } from '@/components/ui/spinner';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { useAuth } from '@/hooks/use-auth';
import { useErrorToast } from '@/hooks/use-error-toast';
import type { NotificationListItem } from '@/types';
import { formatDateTime } from '@/utils/date';
import { getNotificationText } from '@/utils/notification-text';
import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
// 引っ張って更新は gluestack-ui に対応する部品が無いため、React Native の RefreshControl を使う（Web では効かない）
import { RefreshControl } from 'react-native';

// 自分宛ての通知の一覧（新しい順に最大50行。メッセージは同じセッションのものが1行にまとまる）。
// 行をタップするとセッション詳細を開く（既読にするのは詳細の側。一覧を開いただけでは既読にしない）。
// 詳細から戻ったときに既読を反映するため、画面が表示されるたびに読み直す
export function Notifications() {
  const router = useRouter();
  const showError = useErrorToast();
  const { session } = useAuth();
  const userId = session?.user.id;
  const [notifications, setNotifications] = useState<NotificationListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isMarkingAllRead, setIsMarkingAllRead] = useState(false);

  // isCancelled が true を返したら結果を捨てる（画面を離れたあとに古い結果で上書きしない）。
  // 読み直しで失敗したときは、表示中の一覧を残してトーストだけ出す
  const load = useCallback(
    async (isCancelled: () => boolean = () => false) => {
      const { data, error } = await listMyNotifications();
      if (isCancelled()) return;
      if (error || !data) {
        showError('通知を読み込めませんでした');
        return;
      }
      setNotifications(data);
    },
    [showError]
  );

  useFocusEffect(
    useCallback(() => {
      let isCancelled = false;

      (async () => {
        await load(() => isCancelled);
        if (!isCancelled) setIsLoading(false);
      })();

      return () => {
        isCancelled = true;
      };
    }, [load])
  );

  async function handleRefresh() {
    setIsRefreshing(true);
    await load();
    setIsRefreshing(false);
  }

  async function handleMarkAllRead() {
    // (app) のレイアウトがログイン済みを保証しているので、userId が無いことは無い
    if (!userId) return;
    setIsMarkingAllRead(true);
    const { error } = await markAllNotificationsRead(userId);
    if (error) showError('既読にできませんでした');
    // 成功・失敗のどちらでも読み直し、最新の既読の状態を出す
    await load();
    setIsMarkingAllRead(false);
  }

  function handlePressNotification(sessionId: string) {
    router.push({ pathname: '/sessions/[id]', params: { id: sessionId } });
  }

  // ヘッダーは (app) の Stack で非表示にしているため、この画面だけ表示する（session-detail と同じ）
  const header = (
    <Stack.Screen
      options={{ headerShown: true, title: '通知', headerBackButtonDisplayMode: 'minimal' }}
    />
  );

  if (isLoading) {
    return (
      <VStack className="flex-1 items-center justify-center bg-background">
        {header}
        <Spinner size="large" />
      </VStack>
    );
  }

  const hasUnread = notifications.some((notification) => notification.unread_count > 0);

  return (
    <VStack className="flex-1 bg-background">
      {header}

      <ScrollView
        className="flex-1"
        contentContainerClassName="p-4"
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />}
      >
        {/* 広い画面（Web）で横に間延びしないよう、幅を抑えて中央に置く */}
        <VStack space="md" className="w-full max-w-2xl self-center">
          {notifications.length === 0 ? (
            <Text size="md" className="text-center text-muted-foreground">
              通知はまだありません
            </Text>
          ) : (
            <>
              <Button
                variant="outline"
                size="sm"
                className="self-end bg-card"
                isDisabled={!hasUnread || isMarkingAllRead}
                onPress={handleMarkAllRead}
              >
                {isMarkingAllRead && <ButtonSpinner />}
                <ButtonText>すべて既読にする</ButtonText>
              </Button>

              {notifications.map((notification) => {
                const isUnread = notification.unread_count > 0;
                const partnerName = notification.partner_display_name ?? '退会したユーザー';
                const text = getNotificationText(notification);
                return (
                  <Pressable
                    key={`${notification.type}-${notification.session_id}-${notification.created_at}`}
                    onPress={() => handlePressNotification(notification.session_id)}
                    accessibilityRole="button"
                    accessibilityLabel={isUnread ? `未読：${text}` : text}
                    className="data-[active=true]:opacity-80"
                  >
                    <Card size="sm">
                      <HStack space="md" className="items-center">
                        <Avatar size="md">
                          <AvatarFallbackText>{partnerName}</AvatarFallbackText>
                          {notification.partner_avatar_path && (
                            <AvatarImage
                              source={{ uri: getAvatarUrl(notification.partner_avatar_path) }}
                            />
                          )}
                        </Avatar>
                        <VStack space="xs" className="flex-1">
                          <Text size="md" className={isUnread ? 'font-bold' : undefined}>
                            {text}
                          </Text>
                          <Text size="xs" className="text-muted-foreground">
                            {formatDateTime(notification.created_at)}
                          </Text>
                        </VStack>
                        {/* 未読の印。既読の行も同じ幅を空けて、文言の折り返し位置を揃える */}
                        <VStack
                          className={`h-2.5 w-2.5 rounded-full ${isUnread ? 'bg-primary' : 'bg-transparent'}`}
                        />
                      </HStack>
                    </Card>
                  </Pressable>
                );
              })}
            </>
          )}
        </VStack>
      </ScrollView>
    </VStack>
  );
}
