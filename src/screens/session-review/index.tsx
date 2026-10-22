import { getSessionReview } from '@/api/reviews';
import { getSession } from '@/api/sessions';
import { ScrollView } from '@/components/ui/scroll-view';
import { Spinner } from '@/components/ui/spinner';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { useAuth } from '@/hooks/use-auth';
import { useErrorToast } from '@/hooks/use-error-toast';
import type { SessionDetail } from '@/types';
import { canWriteReview, formatReviewDeadline } from '@/utils/review';
import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { ReviewForm } from './components/review-form';

type Props = {
  sessionId: string;
};

// 相談者が、完了したセッションの占い師へのレビューを書く画面。
// メッセージを書く画面と同じく、入力欄がキーボードに隠れないよう詳細画面と分けている。
// 書けない状態（URL から直接開いたときなど）ならフォームを出さない（投稿自体は DB の RLS も弾く）
export function SessionReview({ sessionId }: Props) {
  const showError = useErrorToast();
  const { session: authSession } = useAuth();
  const userId = authSession?.user.id;
  const [session, setSession] = useState<SessionDetail | null>(null);
  const [hasReview, setHasReview] = useState(false);
  // 期限の判定は、読み込んだ時点の時刻で行う
  const [loadedAt, setLoadedAt] = useState(() => new Date());
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // (app) のレイアウトがログイン済みを保証しているので、userId が無いことは無い
    if (!userId) return;
    // 別のセッションの画面へ素早く切り替えたとき、古い結果で上書きしないようにする
    let isCancelled = false;

    (async () => {
      setIsLoading(true);
      const now = new Date();
      const [sessionResult, reviewResult] = await Promise.all([
        getSession(sessionId, userId),
        getSessionReview(sessionId),
      ]);
      if (isCancelled) return;

      if (sessionResult.error || reviewResult.error) {
        showError('やり取りを読み込めませんでした');
        setSession(null);
      } else {
        setSession(sessionResult.data);
        setHasReview(reviewResult.data !== null);
      }
      setLoadedAt(now);
      setIsLoading(false);
    })();

    return () => {
      isCancelled = true;
    };
    // showError は描画ごとに作り直されるため依存に入れない
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, userId]);

  // ヘッダーは (app) の Stack で非表示にしているため、この画面だけ表示する。戻るボタンは矢印だけにする
  const header = (
    <Stack.Screen
      options={{
        headerShown: true,
        title: 'レビューを書く',
        headerBackButtonDisplayMode: 'minimal',
      }}
    />
  );

  // 別のセッションのレビュー画面へ切り替えた直後（読み込みが始まる前の描画）に、前のセッションのフォームを出さない
  if (isLoading || !userId || (session && session.id !== sessionId)) {
    return (
      <VStack className="flex-1 items-center justify-center bg-background">
        {header}
        <Spinner size="large" />
      </VStack>
    );
  }

  const unavailableMessage = !session
    ? 'やり取りを表示できませんでした'
    : hasReview
      ? 'このやり取りにはすでにレビューを投稿しています'
      : !canWriteReview(session, userId, false, loadedAt)
        ? 'このやり取りにはレビューを書けません'
        : null;

  // completed_at は canWriteReview が null でないことを確かめているが、型を絞るためにここでも見る
  if (!session?.completed_at || unavailableMessage) {
    return (
      <VStack className="flex-1 items-center justify-center bg-background p-4">
        {header}
        <Text size="md" className="text-center text-muted-foreground">
          {unavailableMessage}
        </Text>
      </VStack>
    );
  }

  return (
    <VStack className="flex-1 bg-background">
      {header}
      <ScrollView
        className="flex-1"
        contentContainerClassName="p-4"
        keyboardShouldPersistTaps="handled"
      >
        {/* 広い画面（Web）で横に間延びしないよう、幅を抑えて中央に置く */}
        <VStack space="lg" className="w-full max-w-2xl self-center">
          <VStack space="xs">
            <Text size="md">{session.partner_name ?? '退会したユーザー'}さんへのレビュー</Text>
            <Text size="sm" className="text-muted-foreground">
              {formatReviewDeadline(session.completed_at)}
              に投稿できます。投稿したあとは直せません。
            </Text>
          </VStack>
          <ReviewForm sessionId={sessionId} consultantId={userId} tellerId={session.teller_id} />
        </VStack>
      </ScrollView>
    </VStack>
  );
}
