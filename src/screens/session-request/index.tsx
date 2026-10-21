import { getMyBirthdate } from '@/api/profile-private-details';
import { getTeller } from '@/api/tellers';
import { ScrollView } from '@/components/ui/scroll-view';
import { Spinner } from '@/components/ui/spinner';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { useAuth } from '@/hooks/use-auth';
import { useErrorToast } from '@/hooks/use-error-toast';
import type { TellerDetail } from '@/types';
import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { SessionRequestForm } from './components/session-request-form';

type Props = {
  tellerId: string;
};

export function SessionRequest({ tellerId }: Props) {
  const showError = useErrorToast();
  const { session } = useAuth();
  const userId = session?.user.id;
  const [teller, setTeller] = useState<TellerDetail | null>(null);
  const [savedBirthdate, setSavedBirthdate] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // (app) のレイアウトがログイン済みを保証しているので、userId が無いことは無い
    if (!userId) return;
    // 別の占い師の画面へ素早く切り替えたとき、古い結果で上書きしないようにする
    let isCancelled = false;

    (async () => {
      setIsLoading(true);
      const [tellerResult, birthdateResult] = await Promise.all([
        getTeller(tellerId),
        getMyBirthdate(userId),
      ]);
      if (isCancelled) return;

      if (tellerResult.error) {
        showError('占い師を読み込めませんでした');
      } else if (birthdateResult.error) {
        // 生年月日が読めなくても申し込める（初期値が空になるだけ）
        showError('生年月日を読み込めませんでした');
      }
      setTeller(tellerResult.data);
      setSavedBirthdate(birthdateResult.data);
      setIsLoading(false);
    })();

    return () => {
      isCancelled = true;
    };
    // showError は描画ごとに作り直されるため依存に入れない
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tellerId, userId]);

  // ヘッダーは (app) の Stack で非表示にしているため、この画面だけ表示する。戻るボタンは矢印だけにする
  const header = (
    <Stack.Screen
      options={{ headerShown: true, title: '申し込む', headerBackButtonDisplayMode: 'minimal' }}
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

  // URL から直接開いた場合などに備え、申し込めない相手ならフォームを出さない（申込み自体は DB も弾く）
  const unavailableMessage = !teller
    ? '占い師の情報を表示できませんでした'
    : teller.teller_id === userId
      ? '自分には申し込めません'
      : !teller.is_accepting
        ? 'この占い師は現在、申込みを受け付けていません'
        : null;

  if (!teller || unavailableMessage) {
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
        <VStack className="w-full max-w-2xl self-center">
          <SessionRequestForm
            teller={teller}
            consultantId={userId}
            savedBirthdate={savedBirthdate}
          />
        </VStack>
      </ScrollView>
    </VStack>
  );
}
