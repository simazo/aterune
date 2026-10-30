import { getAvatarUrl } from '@/api/avatars';
import { listBlockedUsers, unblockUser } from '@/api/blocks';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { Avatar, AvatarFallbackText, AvatarImage } from '@/components/ui/avatar';
import { Button, ButtonText } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Heading } from '@/components/ui/heading';
import { HStack } from '@/components/ui/hstack';
import { ScrollView } from '@/components/ui/scroll-view';
import { Spinner } from '@/components/ui/spinner';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { useAuth } from '@/hooks/use-auth';
import { useErrorToast } from '@/hooks/use-error-toast';
import { useSuccessToast } from '@/hooks/use-success-toast';
import type { BlockedUser } from '@/types';
import { Stack, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

// 自分がブロックした相談者・占い師の一覧（ブロックの新しい順。退会した相手は出ない）と解除。
// セッション詳細・占い師詳細でブロックして戻ってきたときにも出すため、画面が表示されるたびに読み直す
export function Blocks() {
  const showError = useErrorToast();
  const showSuccess = useSuccessToast();
  const { session } = useAuth();
  const userId = session?.user.id;
  const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  // 一度も読み込めていないか。初回に失敗したとき「いません」と出して、ブロックが消えたと誤解されないようにする
  const [hasNeverLoaded, setHasNeverLoaded] = useState(true);
  // 解除の確認ダイアログを開いている相手
  const [unblockTarget, setUnblockTarget] = useState<BlockedUser | null>(null);
  const [isUnblocking, setIsUnblocking] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let isCancelled = false;

      (async () => {
        const { data, error } = await listBlockedUsers();
        if (isCancelled) return;
        // 読み直しで失敗したときは、表示中の一覧を残してトーストだけ出す
        if (error || !data) {
          showError('ブロック中の相談者・占い師を読み込めませんでした');
        } else {
          setBlockedUsers(data);
          setHasNeverLoaded(false);
        }
        setIsLoading(false);
      })();

      return () => {
        isCancelled = true;
      };
    }, [showError])
  );

  // 解除のあとは読み直さず、一覧からその相手を消す
  async function handleUnblock() {
    // (app) のレイアウトがログイン済みを保証しているので、userId が無いことは無い
    if (!unblockTarget || !userId) return;
    setIsUnblocking(true);
    const { error } = await unblockUser(userId, unblockTarget.blocked_id);
    setIsUnblocking(false);
    if (error) {
      showError('解除できませんでした。時間をおいて、もう一度お試しください');
      return;
    }
    const target = unblockTarget;
    setBlockedUsers((current) => current.filter((u) => u.blocked_id !== target.blocked_id));
    setUnblockTarget(null);
    showSuccess(`${target.display_name}さんのブロックを解除しました`);
  }

  // ヘッダーは (app) の Stack で非表示にしているため、この画面だけ表示する（favorites と同じ）
  const header = (
    <Stack.Screen
      options={{
        headerShown: true,
        title: 'ブロック中の相談者・占い師',
        headerBackButtonDisplayMode: 'minimal',
      }}
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

  return (
    <VStack className="flex-1 bg-background">
      {header}

      <ScrollView className="flex-1" contentContainerClassName="p-4">
        {/* 広い画面（Web）で横に間延びしないよう、幅を抑えて中央に置く */}
        <VStack space="md" className="w-full max-w-2xl self-center">
          {hasNeverLoaded ? (
            <Text size="md" className="text-center text-muted-foreground">
              ブロック中の相談者・占い師を表示できませんでした
            </Text>
          ) : blockedUsers.length === 0 ? (
            <Text size="md" className="text-center text-muted-foreground">
              ブロック中の相談者・占い師はいません。{'\n'}
              やり取りの詳細や占い師の詳細画面の下からブロックできます
            </Text>
          ) : (
            blockedUsers.map((blockedUser) => (
              <Card key={blockedUser.blocked_id} size="sm">
                <HStack space="md" className="items-center">
                  <Avatar size="md">
                    <AvatarFallbackText>{blockedUser.display_name}</AvatarFallbackText>
                    {blockedUser.avatar_path && (
                      <AvatarImage source={{ uri: getAvatarUrl(blockedUser.avatar_path) }} />
                    )}
                  </Avatar>
                  <Heading size="sm" className="flex-1">
                    {blockedUser.display_name}
                  </Heading>
                  <Button
                    size="sm"
                    variant="outline"
                    className="bg-card"
                    isDisabled={isUnblocking}
                    onPress={() => setUnblockTarget(blockedUser)}
                  >
                    <ButtonText>解除する</ButtonText>
                  </Button>
                </HStack>
              </Card>
            ))
          )}
        </VStack>
      </ScrollView>

      <ConfirmDialog
        isOpen={unblockTarget !== null}
        title={`${unblockTarget?.display_name ?? ''}さんのブロックを解除しますか？`}
        description="解除すると、お互いに申込み・お悩みへの応募ができるようになり、占い師の検索やお悩み一覧にも表示されます。相手には知らされません。"
        confirmLabel="解除する"
        isSubmitting={isUnblocking}
        onClose={() => setUnblockTarget(null)}
        onConfirm={handleUnblock}
      />
    </VStack>
  );
}
