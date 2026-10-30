import { KeyboardAwareScrollView } from '@/components/keyboard-aware-scroll-view';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { useAuth } from '@/hooks/use-auth';
import { Stack } from 'expo-router';
import { ReportForm } from './components/report-form';

type Props = {
  reportedUserId: string | undefined;
  // 通報する相手の表示名（前の画面から URL で受け取り、確認のために出すだけ）
  reportedUserName: string | undefined;
  // セッション詳細から開いたときのセッションID。占い師詳細からなら null
  sessionId: string | null;
};

// 相手を運営に通報する画面。セッション詳細・占い師詳細の下端のリンクから開く。
// 当事者か・自分自身でないかは DB（トリガー・CHECK）が確かめるので、画面では受け取った値をそのまま送る
export function Report({ reportedUserId, reportedUserName, sessionId }: Props) {
  const { session: authSession } = useAuth();
  const userId = authSession?.user.id;

  // ヘッダーは (app) の Stack で非表示にしているため、この画面だけ表示する。戻るボタンは矢印だけにする
  const header = (
    <Stack.Screen
      options={{
        headerShown: true,
        title: '通報する',
        headerBackButtonDisplayMode: 'minimal',
      }}
    />
  );

  // URL から直接開いて相手が分からないときは、フォームを出さない。
  // (app) のレイアウトがログイン済みを保証しているので、userId が無いことは無い
  if (!userId || !reportedUserId || !reportedUserName) {
    return (
      <VStack className="flex-1 items-center justify-center bg-background p-4">
        {header}
        <Text size="md" className="text-center text-muted-foreground">
          通報する相手が分かりませんでした
        </Text>
      </VStack>
    );
  }

  return (
    <VStack className="flex-1 bg-background">
      {header}
      <KeyboardAwareScrollView className="flex-1" contentContainerClassName="p-4">
        {/* 広い画面（Web）で横に間延びしないよう、幅を抑えて中央に置く */}
        <VStack space="lg" className="w-full max-w-2xl self-center">
          <VStack space="xs">
            <Text size="md">{reportedUserName}さんを運営に通報します</Text>
            <Text size="sm" className="text-muted-foreground">
              通報したことは相手に知らされません。内容を確かめたうえで、運営が対応します。
            </Text>
          </VStack>
          <ReportForm reporterId={userId} reportedUserId={reportedUserId} sessionId={sessionId} />
        </VStack>
      </KeyboardAwareScrollView>
    </VStack>
  );
}
