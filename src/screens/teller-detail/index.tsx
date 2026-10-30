import { listTellerReviews } from '@/api/reviews';
import { hasOpenSessionWithTeller } from '@/api/sessions';
import { getTeller } from '@/api/tellers';
import { BlockUserLink } from '@/components/block-user-link';
import { ReportUserLink } from '@/components/report-user-link';
import { Badge, BadgeText } from '@/components/ui/badge';
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
import { logger } from '@/lib/logger';
import type { TagCategory, TellerDetail as TellerDetailData, TellerReview } from '@/types';
import { CATEGORY_LABELS } from '@/utils/teller';
import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FavoriteButton } from './components/favorite-button';
import { ReviewList } from './components/review-list';
import { TellerProfileHeader } from './components/teller-profile-header';

// 詳細画面に出すレビューの件数（新しい順）
const REVIEW_PREVIEW_COUNT = 5;

type Props = {
  tellerId: string;
};

export function TellerDetail({ tellerId }: Props) {
  const router = useRouter();
  const showError = useErrorToast();
  const { session } = useAuth();
  const userId = session?.user.id;
  const insets = useSafeAreaInsets();
  const [teller, setTeller] = useState<TellerDetailData | null>(null);
  const [reviews, setReviews] = useState<TellerReview[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  // この占い師に、承認待ち・進行中の申込みがあるか。確かめ終わるまでは null
  const [hasOpenSession, setHasOpenSession] = useState<boolean | null>(null);
  // 申込み画面へ移る途中か。ボタンを素早く何度も押すと、申込み画面が重なって開くのを防ぐ
  const isNavigatingRef = useRef(false);

  // 申込み画面から戻ったときにボタンを「申込み済み」に変えるため、画面が表示されるたびに確かめ直す
  useFocusEffect(
    useCallback(() => {
      // 戻ってきたら、また申込み画面へ移れるようにする
      isNavigatingRef.current = false;
      if (!userId) return;
      let isCancelled = false;

      (async () => {
        const { data, error } = await hasOpenSessionWithTeller(userId, tellerId);
        if (isCancelled) return;
        // 確かめられなくても申し込めるようにする（二重の申込みは DB が弾く）
        if (error) {
          logger.warn('申込み状況の取得エラー:', error.message);
        }
        setHasOpenSession(data ?? false);
      })();

      return () => {
        isCancelled = true;
      };
    }, [tellerId, userId])
  );

  useEffect(() => {
    // 別の占い師の画面へ素早く切り替えたとき、古い結果で上書きしないようにする
    let isCancelled = false;

    (async () => {
      setIsLoading(true);
      // 前の占い師の申込み状況を残さない（確かめ直すまでボタンを押せなくする）
      setHasOpenSession(null);
      const [tellerResult, reviewsResult] = await Promise.all([
        getTeller(tellerId),
        listTellerReviews(tellerId, REVIEW_PREVIEW_COUNT),
      ]);
      if (isCancelled) return;

      if (tellerResult.error) {
        showError('占い師を読み込めませんでした');
      } else if (reviewsResult.error) {
        showError('レビューを読み込めませんでした');
      }
      setTeller(tellerResult.data);
      setReviews(reviewsResult.data ?? []);
      setIsLoading(false);
    })();

    return () => {
      isCancelled = true;
    };
  }, [tellerId, showError]);

  // ヘッダーは (app) の Stack で非表示にしているため、この画面だけ表示する（上のセーフエリアはヘッダーが避ける）。
  // 戻るボタンは矢印だけにする（前の画面のタイトルは出さない）。
  // 読み込み中は、別の占い師へ切り替えたときに前の人の名前が残らないようタイトルを空にする。
  // お気に入りのボタンは、占い師を表示できていて、自分のプロフィールでないときだけ右端に出す。
  // 占い師が変わったら作り直し、前の占い師の保存結果が新しい占い師の表示に反映されないようにする（key）
  const canFavorite = !isLoading && !!teller && !!userId && userId !== teller.teller_id;

  // 登録・解除のあとは読み直さず、表示している人数だけを増減する
  function handleFavoriteChange(isFavorite: boolean) {
    setTeller((current) =>
      current && { ...current, favorite_count: current.favorite_count + (isFavorite ? 1 : -1) }
    );
  }

  const header = (
    <Stack.Screen
      options={{
        headerShown: true,
        title: isLoading ? '' : (teller?.display_name ?? ''),
        headerBackButtonDisplayMode: 'minimal',
        headerRight:
          canFavorite && userId
            ? () => (
                <FavoriteButton
                  key={tellerId}
                  userId={userId}
                  tellerId={tellerId}
                  onChange={handleFavoriteChange}
                />
              )
            : undefined,
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

  // 存在しない ID・占い師でないユーザーの ID・読み込みの失敗
  if (!teller) {
    return (
      <VStack className="flex-1 items-center justify-center bg-background p-4">
        {header}
        <Text size="md" className="text-center text-muted-foreground">
          占い師の情報を表示できませんでした
        </Text>
      </VStack>
    );
  }

  const isOwnProfile = userId === teller.teller_id;
  const applyLabel = isOwnProfile
    ? '自分のプロフィールです'
    : !teller.is_accepting
      ? '受付停止中です'
      : hasOpenSession
        ? '申込み済み'
        : 'この占い師に申し込む';
  // 申込み済みかを確かめ終わるまでは押せない（null の間）
  const canApply = !isOwnProfile && teller.is_accepting && hasOpenSession === false;

  // ブロックした相手は詳細にも出なくなる（get_teller が返さない）ため、前の画面に戻る。
  // URL・通知から直接開いて戻る先が無ければ、さがすタブへ移る
  function handleBlocked() {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/');
    }
  }

  function handleApply() {
    if (isNavigatingRef.current) return;
    isNavigatingRef.current = true;
    router.push({ pathname: '/tellers/[id]/request', params: { id: tellerId } });
  }

  // 1つ以上タグがある種類だけ、CATEGORY_LABELS の順に出す
  const tagCategories = (Object.keys(CATEGORY_LABELS) as TagCategory[]).filter((category) =>
    teller.tags.some((tag) => tag.category === category)
  );

  return (
    <VStack className="flex-1 bg-background">
      {header}

      <ScrollView className="flex-1" contentContainerClassName="p-4">
        {/* 広い画面（Web）で横に間延びしないよう、幅を抑えて中央に置く */}
        <VStack space="lg" className="w-full max-w-2xl self-center">
          <TellerProfileHeader teller={teller} />

          {teller.self_pr && (
            <Card>
              <VStack space="sm">
                <Heading size="md">自己紹介</Heading>
                <Text size="md">{teller.self_pr}</Text>
              </VStack>
            </Card>
          )}

          {tagCategories.length > 0 && (
            <Card>
              <VStack space="md">
                {tagCategories.map((category) => (
                  <VStack key={category} space="xs">
                    <Heading size="sm">{CATEGORY_LABELS[category]}</Heading>
                    <HStack className="flex-wrap" space="xs">
                      {teller.tags
                        .filter((tag) => tag.category === category)
                        .map((tag) => (
                          <Badge
                            key={tag.slug}
                            variant={category === 'divination' ? 'secondary' : 'outline'}
                          >
                            <BadgeText>{tag.name}</BadgeText>
                          </Badge>
                        ))}
                    </HStack>
                  </VStack>
                ))}
              </VStack>
            </Card>
          )}

          {teller.requires_birthdate && (
            <Card>
              <VStack space="sm">
                <Heading size="md">申込みについて</Heading>
                <Text size="sm">申込みには生年月日の登録が必要です</Text>
              </VStack>
            </Card>
          )}

          <ReviewList reviews={reviews} reviewCount={teller.review_count} />

          {!isOwnProfile && userId && (
            <VStack space="md" className="mt-4">
              <BlockUserLink
                userId={userId}
                otherUserId={teller.teller_id}
                otherUserName={teller.display_name}
                onBlocked={handleBlocked}
              />
              <ReportUserLink
                otherUserId={teller.teller_id}
                otherUserName={teller.display_name}
                sessionId={null}
              />
            </VStack>
          )}
        </VStack>
      </ScrollView>

      {/* 画面下に固定する。ホームバー（下のセーフエリア）に重ならないよう、その高さの分だけ下に余白を足す */}
      <VStack
        className="border-t border-border bg-card px-4 pt-3"
        style={{ paddingBottom: insets.bottom + 12 }}
      >
        <Button
          size="lg"
          isDisabled={!canApply}
          onPress={handleApply}
          className="w-full max-w-2xl self-center"
        >
          <ButtonText>{applyLabel}</ButtonText>
        </Button>
      </VStack>
    </VStack>
  );
}
