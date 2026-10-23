import { closeConsultationPost, getConsultationPost } from '@/api/consultation-posts';
import { getMyProfile } from '@/api/profiles';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { Badge, BadgeText } from '@/components/ui/badge';
import { Button, ButtonText } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { HStack } from '@/components/ui/hstack';
import { ScrollView } from '@/components/ui/scroll-view';
import { Spinner } from '@/components/ui/spinner';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { useAuth } from '@/hooks/use-auth';
import { useErrorToast } from '@/hooks/use-error-toast';
import { useSuccessToast } from '@/hooks/use-success-toast';
import type { ConsultationPostListItem } from '@/types';
import { CONSULTATION_POST_STATUS_LABELS } from '@/utils/consultation-post-display';
import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';

function formatDate(value: string) {
  const date = new Date(value);
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
}

type Props = {
  postId: string;
};

// お悩み投稿の詳細。投稿者は匿名なので名前は出さない。
// 応募ボタンは、占い師登録済みで、自分の投稿ではないときだけ出す（応募できる人の制限は DB も守る）
export function ConcernDetail({ postId }: Props) {
  const router = useRouter();
  const showError = useErrorToast();
  const showSuccess = useSuccessToast();
  const { session } = useAuth();
  const userId = session?.user.id;
  const [post, setPost] = useState<ConsultationPostListItem | null>(null);
  const [isTeller, setIsTeller] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isCloseDialogOpen, setIsCloseDialogOpen] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  // 応募して戻ったときに「応募済み」を出すため、画面が表示されるたびに読み直す
  useFocusEffect(
    useCallback(() => {
      // (app) のレイアウトがログイン済みを保証しているので、userId が無いことは無い
      if (!userId) return;
      let isCancelled = false;

      (async () => {
        const [postResult, profileResult] = await Promise.all([
          getConsultationPost(postId),
          getMyProfile(userId),
        ]);
        if (isCancelled) return;

        if (postResult.error || profileResult.error) {
          showError('お悩みを読み込めませんでした');
        } else {
          setPost(postResult.data);
          setIsTeller(profileResult.data.is_teller);
        }
        setIsLoading(false);
      })();

      return () => {
        isCancelled = true;
      };
      // showError は描画ごとに作り直されるため依存に入れない
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [postId, userId])
  );

  // 自分の投稿を閉じる。閉じられるのが本人だけであることは DB の close_consultation_post が守り、
  // 画面では本人にしかボタンを出さないため、失敗は通信エラーなどに限られる
  async function handleClose() {
    setIsClosing(true);
    const { error } = await closeConsultationPost(postId);
    if (error) {
      showError('閉じられませんでした。時間をおいて、もう一度お試しください');
      setIsClosing(false);
      return;
    }

    // 読み直さずに、閉じた状態を画面に反映する（閉じた投稿は本人なら読めるが、状態以外は変わらない）
    setPost((current) => (current ? { ...current, status: 'closed' } : current));
    setIsClosing(false);
    setIsCloseDialogOpen(false);
    showSuccess('お悩みを閉じました');
  }

  // ヘッダーは (app) の Stack で非表示にしているため、この画面だけ表示する。戻るボタンは矢印だけにする
  const header = (
    <Stack.Screen
      options={{ headerShown: true, title: 'お悩み', headerBackButtonDisplayMode: 'minimal' }}
    />
  );

  // 別の投稿の詳細へ切り替えた直後（読み込みが始まる前の描画）に、前の投稿を出さない
  if (isLoading || (post && post.id !== postId)) {
    return (
      <VStack className="flex-1 items-center justify-center bg-background">
        {header}
        <Spinner size="large" />
      </VStack>
    );
  }

  // 閉じられた他人の投稿や存在しない ID は、DB が返さない
  if (!post) {
    return (
      <VStack className="flex-1 items-center justify-center bg-background p-4">
        {header}
        <Text size="md" className="text-center text-muted-foreground">
          このお悩みは表示できません
        </Text>
      </VStack>
    );
  }

  const canApply = isTeller && !post.is_mine && !post.has_applied && post.status !== 'closed';

  return (
    <VStack className="flex-1 bg-background">
      {header}
      <ScrollView className="flex-1" contentContainerClassName="p-4">
        {/* 広い画面（Web）で横に間延びしないよう、幅を抑えて中央に置く */}
        <VStack className="w-full max-w-2xl self-center" space="lg">
          <Card>
            <VStack space="md">
              <HStack className="items-center justify-between" space="sm">
                <HStack className="flex-1 flex-wrap" space="xs">
                  <Badge variant="secondary">
                    <BadgeText>{post.concern_tag_name}</BadgeText>
                  </Badge>
                  <Badge variant="outline">
                    <BadgeText>
                      {CONSULTATION_POST_STATUS_LABELS[post.status] ?? post.status}
                    </BadgeText>
                  </Badge>
                </HStack>
                <Text size="xs" className="text-muted-foreground">
                  {formatDate(post.created_at)}
                </Text>
              </HStack>
              <Text size="md">{post.concern}</Text>
            </VStack>
          </Card>

          {post.is_mine ? (
            <VStack space="md">
              <Text size="sm" className="text-center text-muted-foreground">
                {post.status === 'closed'
                  ? 'あなたの投稿です。閉じたため、新しい応募は受け付けていません'
                  : 'あなたの投稿です'}
              </Text>
              {post.status !== 'closed' && (
                <Button
                  size="lg"
                  variant="outline"
                  className="bg-card"
                  onPress={() => setIsCloseDialogOpen(true)}
                >
                  <ButtonText>このお悩みを閉じる</ButtonText>
                </Button>
              )}
            </VStack>
          ) : post.has_applied ? (
            // 拒否・期限切れのあとも同じお悩みには再び応募できないため、応募済みのままにする
            <Button size="lg" isDisabled>
              <ButtonText>応募済み</ButtonText>
            </Button>
          ) : (
            canApply && (
              <Button
                size="lg"
                onPress={() =>
                  router.push({ pathname: '/concerns/[id]/apply', params: { id: post.id } })
                }
              >
                <ButtonText>応募する</ButtonText>
              </Button>
            )
          )}
        </VStack>
      </ScrollView>

      <ConfirmDialog
        isOpen={isCloseDialogOpen}
        title="このお悩みを閉じますか？"
        description="閉じると、新しい応募を受け付けなくなります。承認待ち・進行中のやり取りはそのまま続きます。閉じたお悩みは再開できません。"
        confirmLabel="閉じる"
        confirmVariant="destructive"
        isSubmitting={isClosing}
        onClose={() => setIsCloseDialogOpen(false)}
        onConfirm={handleClose}
      />
    </VStack>
  );
}
