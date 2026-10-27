import { listFavoriteTellers } from '@/api/favorites';
import { TellerCard } from '@/components/teller-card';
import { HStack } from '@/components/ui/hstack';
import { ScrollView } from '@/components/ui/scroll-view';
import { Spinner } from '@/components/ui/spinner';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { useErrorToast } from '@/hooks/use-error-toast';
import type { TellerSearchResult } from '@/types';
import { Stack, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

// 自分がお気に入り登録した占い師の一覧（登録の新しい順。受付停止中も出す）。
// 詳細でお気に入りから外して戻ってきたときに一覧から消すため、画面が表示されるたびに読み直す
export function Favorites() {
  const showError = useErrorToast();
  const [tellers, setTellers] = useState<TellerSearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  // 一度も読み込めていないか。初回に失敗したとき「まだいません」と出して、お気に入りが消えたと誤解されないようにする
  const [hasNeverLoaded, setHasNeverLoaded] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let isCancelled = false;

      (async () => {
        const { data, error } = await listFavoriteTellers();
        if (isCancelled) return;
        // 読み直しで失敗したときは、表示中の一覧を残してトーストだけ出す
        if (error || !data) {
          showError('お気に入りの占い師を読み込めませんでした');
        } else {
          setTellers(data);
          setHasNeverLoaded(false);
        }
        setIsLoading(false);
      })();

      return () => {
        isCancelled = true;
      };
    }, [showError])
  );

  // ヘッダーは (app) の Stack で非表示にしているため、この画面だけ表示する（notifications と同じ）
  const header = (
    <Stack.Screen
      options={{
        headerShown: true,
        title: 'お気に入りの占い師',
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
        <VStack className="w-full max-w-4xl self-center">
          {hasNeverLoaded ? (
            <Text size="md" className="text-center text-muted-foreground">
              お気に入りの占い師を表示できませんでした
            </Text>
          ) : tellers.length === 0 ? (
            <Text size="md" className="text-center text-muted-foreground">
              お気に入りの占い師はまだいません。{'\n'}
              占い師の詳細画面のハートから登録できます
            </Text>
          ) : (
            // さがすタブと同じく、スマホは1列、幅 768px 以上（md）は2列。カードの間隔は各カードの外側の余白（p-2）で取る
            <HStack className="-m-2 flex-wrap">
              {tellers.map((teller) => (
                <VStack key={teller.teller_id} className="w-full p-2 md:w-1/2">
                  <TellerCard teller={teller} />
                </VStack>
              ))}
            </HStack>
          )}
        </VStack>
      </ScrollView>
    </VStack>
  );
}
