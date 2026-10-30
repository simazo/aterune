import { Link, LinkText } from '@/components/ui/link';
import { ScrollView } from '@/components/ui/scroll-view';
import { VStack } from '@/components/ui/vstack';
import { useReplaceAfterDismiss } from '@/hooks/use-replace-after-dismiss';
import { Stack, useRouter } from 'expo-router';
import type { ReactNode } from 'react';

type DocumentPageProps = {
  title: string;
  children: ReactNode;
};

// 利用規約・よくある質問など、どちらのグループにも入らない場所に置く、読むだけのページの枠。
// ヘッダーの表示と、直接開いたときのトップへのリンクを受け持ち、中身は children で受け取る
export function DocumentPage({ title, children }: DocumentPageProps) {
  const router = useRouter();
  const replaceAfterDismiss = useReplaceAfterDismiss();
  // Web の再読み込みなどで直接開くと、ヘッダーに戻るボタンが出ない。そのときだけ下端にトップへのリンクを出す
  const canGoBack = router.canGoBack();

  return (
    <ScrollView className="flex-1 bg-background" contentContainerClassName="p-4">
      {/* ヘッダーはルートの Stack で非表示にしているため、この画面だけ表示する。戻るボタンは矢印だけにする */}
      <Stack.Screen
        options={{
          headerShown: true,
          title,
          headerBackButtonDisplayMode: 'minimal',
        }}
      />
      {/* 広い画面（Web）で横に間延びしないよう、幅を抑えて中央に置く */}
      <VStack className="w-full max-w-2xl self-center" space="xl">
        {children}

        {!canGoBack && (
          // 未ログインなら、/ から (app) のレイアウトがログイン画面へ移す
          <Link className="self-center" onPress={() => replaceAfterDismiss('/')}>
            <LinkText size="sm">トップへ</LinkText>
          </Link>
        )}
      </VStack>
    </ScrollView>
  );
}
