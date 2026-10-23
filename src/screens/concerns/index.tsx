import { listConsultationPosts, listMyConsultationPosts } from '@/api/consultation-posts';
import { SelectableButton } from '@/components/selectable-button';
import { Button, ButtonText } from '@/components/ui/button';
import { HStack } from '@/components/ui/hstack';
import { ScrollView } from '@/components/ui/scroll-view';
import { Spinner } from '@/components/ui/spinner';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { useErrorToast } from '@/hooks/use-error-toast';
import type { ConsultationPostListItem, MyConsultationPost } from '@/types';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ConcernCard } from './components/concern-card';

type ListKind = 'all' | 'mine';

const LIST_LABELS: Record<ListKind, string> = {
  all: 'みんなのお悩み',
  mine: '自分の投稿',
};

// お悩み一覧（募集中・対応中の投稿を新着順）と、自分の投稿（閉じたものも含む）を切り替えて見せる。
// 投稿は誰でもできるので、切り替えは全員に出す
export function Concerns() {
  const router = useRouter();
  const showError = useErrorToast();
  const [posts, setPosts] = useState<ConsultationPostListItem[]>([]);
  const [myPosts, setMyPosts] = useState<MyConsultationPost[]>([]);
  const [listKind, setListKind] = useState<ListKind>('all');
  const [isLoading, setIsLoading] = useState(true);

  // 投稿・応募・閉じる操作をして戻ったときに新しい状態を出すため、画面が表示されるたびに両方を読み直す
  useFocusEffect(
    useCallback(() => {
      let isCancelled = false;

      (async () => {
        const [postsResult, myPostsResult] = await Promise.all([
          listConsultationPosts(),
          listMyConsultationPosts(),
        ]);
        if (isCancelled) return;

        if (postsResult.error || myPostsResult.error) {
          showError('お悩みを読み込めませんでした');
        } else {
          setPosts(postsResult.data ?? []);
          setMyPosts(myPostsResult.data ?? []);
        }
        setIsLoading(false);
      })();

      return () => {
        isCancelled = true;
      };
    }, [showError])
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

        <HStack space="xs">
          {(Object.keys(LIST_LABELS) as ListKind[]).map((kind) => (
            <SelectableButton
              key={kind}
              label={LIST_LABELS[kind]}
              isSelected={listKind === kind}
              onPress={() => setListKind(kind)}
            />
          ))}
        </HStack>

        {listKind === 'all' ? (
          posts.length === 0 ? (
            <Text size="md" className="text-center text-muted-foreground">
              まだお悩みの投稿はありません
            </Text>
          ) : (
            posts.map((post) => <ConcernCard key={post.id} post={post} />)
          )
        ) : myPosts.length === 0 ? (
          <Text size="md" className="text-center text-muted-foreground">
            まだお悩みを投稿していません
          </Text>
        ) : (
          myPosts.map((post) => <ConcernCard key={post.id} post={post} showsAllStatuses />)
        )}
      </VStack>
    </ScrollView>
  );
}
