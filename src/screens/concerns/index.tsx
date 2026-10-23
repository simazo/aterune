import { listConsultationPosts } from '@/api/consultation-posts';
import { Button, ButtonText } from '@/components/ui/button';
import { ScrollView } from '@/components/ui/scroll-view';
import { Spinner } from '@/components/ui/spinner';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { useErrorToast } from '@/hooks/use-error-toast';
import type { ConsultationPostListItem } from '@/types';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ConcernCard } from './components/concern-card';

// お悩み一覧（募集中・対応中の投稿を新着順）と、お悩みを投稿する画面への入口
export function Concerns() {
  const router = useRouter();
  const showError = useErrorToast();
  const [posts, setPosts] = useState<ConsultationPostListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // 投稿して戻ったときに新しい投稿を出すため、画面が表示されるたびに読み直す
  useFocusEffect(
    useCallback(() => {
      let isCancelled = false;

      (async () => {
        const { data, error } = await listConsultationPosts();
        if (isCancelled) return;

        if (error) {
          showError('お悩みを読み込めませんでした');
        } else {
          setPosts(data ?? []);
        }
        setIsLoading(false);
      })();

      return () => {
        isCancelled = true;
      };
      // showError は描画ごとに作り直されるため依存に入れない
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])
  );

  if (isLoading) {
    return (
      <VStack className="flex-1 items-center justify-center bg-background">
        <Spinner size="large" />
      </VStack>
    );
  }

  return (
    <ScrollView className="flex-1 bg-background" contentContainerClassName="p-4">
      {/* 広い画面（Web）で横に間延びしないよう、幅を抑えて中央に置く */}
      <VStack className="w-full max-w-2xl self-center" space="md">
        <Button onPress={() => router.push('/concerns/new')}>
          <ButtonText>お悩みを投稿する</ButtonText>
        </Button>

        {posts.length === 0 ? (
          <Text size="md" className="text-center text-muted-foreground">
            まだお悩みの投稿はありません
          </Text>
        ) : (
          posts.map((post) => <ConcernCard key={post.id} post={post} />)
        )}
      </VStack>
    </ScrollView>
  );
}
