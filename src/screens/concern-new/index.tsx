import { listTags } from '@/api/tags';
import { KeyboardAwareScrollView } from '@/components/keyboard-aware-scroll-view';
import { Spinner } from '@/components/ui/spinner';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { useAuth } from '@/hooks/use-auth';
import { useErrorToast } from '@/hooks/use-error-toast';
import type { Tag } from '@/types';
import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { ConcernNewForm } from './components/concern-new-form';

type ConcernTag = Pick<Tag, 'id' | 'name'>;

// お悩みを投稿する画面。悩みの種類の選択肢（悩みタグ）を読み込んでからフォームを出す
export function ConcernNew() {
  const showError = useErrorToast();
  const { session } = useAuth();
  const userId = session?.user.id;
  const [concernTags, setConcernTags] = useState<ConcernTag[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isCancelled = false;

    (async () => {
      const { data, error } = await listTags();
      if (isCancelled) return;

      if (error) {
        showError('悩みの種類を読み込めませんでした');
      } else {
        // listTags は種類 → 表示順に並んでいるので、絞り込むだけで表示順になる
        setConcernTags((data ?? []).filter((tag) => tag.category === 'concern'));
      }
      setIsLoading(false);
    })();

    return () => {
      isCancelled = true;
    };
  }, [showError]);

  // ヘッダーは (app) の Stack で非表示にしているため、この画面だけ表示する。戻るボタンは矢印だけにする
  const header = (
    <Stack.Screen
      options={{ headerShown: true, title: 'お悩みを投稿', headerBackButtonDisplayMode: 'minimal' }}
    />
  );

  // (app) のレイアウトがログイン済みを保証しているので、userId が無いことは無い
  if (isLoading || !userId) {
    return (
      <VStack className="flex-1 items-center justify-center bg-background">
        {header}
        <Spinner size="large" />
      </VStack>
    );
  }

  // 選択肢が無いと投稿できない（悩みの種類は必須）ので、フォームを出さない
  if (concernTags.length === 0) {
    return (
      <VStack className="flex-1 items-center justify-center bg-background p-4">
        {header}
        <Text size="md" className="text-center text-muted-foreground">
          投稿画面を表示できませんでした
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
          <ConcernNewForm consultantId={userId} concernTags={concernTags} />
        </VStack>
      </KeyboardAwareScrollView>
    </VStack>
  );
}
