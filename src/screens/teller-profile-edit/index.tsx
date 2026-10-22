import { listTags } from '@/api/tags';
import { getMyTellerProfile } from '@/api/tellers';
import { ScrollView } from '@/components/ui/scroll-view';
import { Spinner } from '@/components/ui/spinner';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { useAuth } from '@/hooks/use-auth';
import { useErrorToast } from '@/hooks/use-error-toast';
import type { Tag } from '@/types';
import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { TellerProfileForm } from './components/teller-profile-form';
import type { TellerProfileEditFormValues } from './schema';

type TagOption = Pick<Tag, 'id' | 'category' | 'name'>;

type Loaded = {
  tags: TagOption[];
  defaultValues: TellerProfileEditFormValues;
  isNew: boolean;
};

// 登録時の初期値
const NEW_TELLER_VALUES: TellerProfileEditFormValues = {
  divinationTagIds: [],
  concernTagIds: [],
  styleTagIds: [],
  selfPr: '',
  trainingPeriod: '',
  isAccepting: true,
  requiresBirthdate: false,
};

// 占い師として未登録なら登録、登録済みなら編集の画面として表示する
export function TellerProfileEdit() {
  const showError = useErrorToast();
  const { session } = useAuth();
  const userId = session?.user.id;
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // (app) のレイアウトがログイン済みを保証しているので、userId が無いことは無い
    if (!userId) return;
    let isCancelled = false;

    (async () => {
      const [tagsResult, profileResult] = await Promise.all([
        listTags(),
        getMyTellerProfile(userId),
      ]);
      if (isCancelled) return;

      // 登録済みかどうかが分からないまま出すと、登録済みの内容を初期値で上書きしてしまうため、フォームを出さない
      if (tagsResult.error || profileResult.error) {
        showError('占い師プロフィールを読み込めませんでした');
      } else {
        const tags = tagsResult.data;
        const profile = profileResult.data;
        // 付いているタグの ID を、種類ごとに分ける
        const tagIdsOf = (category: TagOption['category']) =>
          tags
            .filter((tag) => tag.category === category && profile?.tag_ids.includes(tag.id))
            .map((tag) => tag.id);

        setLoaded({
          tags,
          isNew: !profile,
          defaultValues: profile
            ? {
                divinationTagIds: tagIdsOf('divination'),
                concernTagIds: tagIdsOf('concern'),
                styleTagIds: tagIdsOf('style'),
                selfPr: profile.self_pr ?? '',
                trainingPeriod: profile.training_period ?? '',
                isAccepting: profile.is_accepting,
                requiresBirthdate: profile.requires_birthdate,
              }
            : NEW_TELLER_VALUES,
        });
      }
      setIsLoading(false);
    })();

    return () => {
      isCancelled = true;
    };
    // showError は描画ごとに作り直されるため依存に入れない
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  // ヘッダーは (app) の Stack で非表示にしているため、この画面だけ表示する。戻るボタンは矢印だけにする
  const header = (
    <Stack.Screen
      options={{
        headerShown: true,
        // 登録済みかどうかが分かるまで（読み込み中・失敗時）は、どちらにも当てはまる題名にする
        title: !loaded
          ? '占い師プロフィール'
          : loaded.isNew
            ? '占い師として登録'
            : '占い師プロフィール編集',
        headerBackButtonDisplayMode: 'minimal',
      }}
    />
  );

  if (isLoading || !userId) {
    return (
      <VStack className="flex-1 items-center justify-center bg-background">
        {header}
        <Spinner size="large" />
      </VStack>
    );
  }

  if (!loaded) {
    return (
      <VStack className="flex-1 items-center justify-center bg-background p-4">
        {header}
        <Text size="md" className="text-center text-muted-foreground">
          占い師プロフィールを表示できませんでした
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
        <VStack className="w-full max-w-2xl self-center">
          <TellerProfileForm
            tags={loaded.tags}
            defaultValues={loaded.defaultValues}
            isNew={loaded.isNew}
          />
        </VStack>
      </ScrollView>
    </VStack>
  );
}
