import { getConsultationPost } from '@/api/consultation-posts';
import { KeyboardAwareScrollView } from '@/components/keyboard-aware-scroll-view';
import { Spinner } from '@/components/ui/spinner';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { useErrorToast } from '@/hooks/use-error-toast';
import type { ConsultationPostListItem } from '@/types';
import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { ConcernApplyForm } from './components/concern-apply-form';

type Props = {
  postId: string;
};

// 占い師がお悩み投稿に応募する画面。応募先のお悩みを読み込んでからフォームを出す
export function ConcernApply({ postId }: Props) {
  const showError = useErrorToast();
  const [post, setPost] = useState<ConsultationPostListItem | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // 別の投稿の応募画面へ素早く切り替えたとき、古い結果で上書きしないようにする
    let isCancelled = false;

    (async () => {
      setIsLoading(true);
      const { data, error } = await getConsultationPost(postId);
      if (isCancelled) return;

      if (error) showError('お悩みを読み込めませんでした');
      setPost(data);
      setIsLoading(false);
    })();

    return () => {
      isCancelled = true;
    };
    // showError は描画ごとに作り直されるため依存に入れない
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postId]);

  // ヘッダーは (app) の Stack で非表示にしているため、この画面だけ表示する。戻るボタンは矢印だけにする
  const header = (
    <Stack.Screen
      options={{ headerShown: true, title: '応募する', headerBackButtonDisplayMode: 'minimal' }}
    />
  );

  // 別の投稿の応募画面へ切り替えた直後（読み込みが始まる前の描画）に、前の投稿のフォームを出さない
  if (isLoading || (post && post.id !== postId)) {
    return (
      <VStack className="flex-1 items-center justify-center bg-background">
        {header}
        <Spinner size="large" />
      </VStack>
    );
  }

  // URL から直接開いた場合などに備え、応募できない投稿ならフォームを出さない（応募自体は DB も弾く）。
  // 占い師でない人の応募は DB の文言で伝える（ここで確かめるにはプロフィールの読み込みが増えるため）
  const unavailableMessage = !post
    ? 'このお悩みは表示できません'
    : post.is_mine
      ? '自分のお悩みには応募できません'
      : post.has_applied
        ? 'このお悩みにはすでに応募しています'
        : post.status === 'closed'
          ? 'このお悩みは閉じられたため、応募できません'
          : null;

  if (!post || unavailableMessage) {
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
      <KeyboardAwareScrollView className="flex-1" contentContainerClassName="p-4">
        {/* 広い画面（Web）で横に間延びしないよう、幅を抑えて中央に置く */}
        <VStack className="w-full max-w-2xl self-center">
          <ConcernApplyForm post={post} />
        </VStack>
      </KeyboardAwareScrollView>
    </VStack>
  );
}
