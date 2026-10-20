import { listTellerReviews } from '@/api/reviews';
import { getTeller } from '@/api/tellers';
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
import type { TagCategory, TellerDetail as TellerDetailData, TellerReview } from '@/types';
import { CATEGORY_LABELS } from '@/utils/teller';
import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ReviewList } from './components/review-list';
import { TellerProfileHeader } from './components/teller-profile-header';

// 詳細画面に出すレビューの件数（新しい順）
const REVIEW_PREVIEW_COUNT = 5;

type Props = {
  tellerId: string;
};

export function TellerDetail({ tellerId }: Props) {
  const showError = useErrorToast();
  const { session } = useAuth();
  const insets = useSafeAreaInsets();
  const [teller, setTeller] = useState<TellerDetailData | null>(null);
  const [reviews, setReviews] = useState<TellerReview[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // 別の占い師の画面へ素早く切り替えたとき、古い結果で上書きしないようにする
    let isCancelled = false;

    (async () => {
      setIsLoading(true);
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
    // showError は描画ごとに作り直されるため依存に入れない
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tellerId]);

  // ヘッダーは (app) の Stack で非表示にしているため、この画面だけ表示する（上のセーフエリアはヘッダーが避ける）。
  // 戻るボタンは矢印だけにする（前の画面のタイトルは出さない）。
  // 読み込み中は、別の占い師へ切り替えたときに前の人の名前が残らないようタイトルを空にする
  const header = (
    <Stack.Screen
      options={{
        headerShown: true,
        title: isLoading ? '' : (teller?.display_name ?? ''),
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

  const isOwnProfile = session?.user.id === teller.teller_id;
  const applyLabel = isOwnProfile
    ? '自分のプロフィールです'
    : teller.is_accepting
      ? 'この占い師に申し込む'
      : '受付停止中です';
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
        </VStack>
      </ScrollView>

      {/* 画面下に固定する。ホームバー（下のセーフエリア）に重ならないよう、その高さの分だけ下に余白を足す */}
      <VStack
        className="border-t border-border bg-card px-4 pt-3"
        style={{ paddingBottom: insets.bottom + 12 }}
      >
        {/* TODO: 仮実装。申込み機能が未実装のため常に押せない。
            本実装では申込み画面へ遷移させ、受付停止中・自分自身のときだけ押せなくする */}
        <Button size="lg" isDisabled className="w-full max-w-2xl self-center">
          <ButtonText>{applyLabel}</ButtonText>
        </Button>
      </VStack>
    </VStack>
  );
}
