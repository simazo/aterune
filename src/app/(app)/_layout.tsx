import { useAuth } from '@/hooks/use-auth';
import { Redirect, Stack } from 'expo-router';

export default function AppLayout() {
  const { session } = useAuth();

  if (!session) {
    return <Redirect href="/(auth)/login" />;
  }

  // タブ（(tabs)）の上に、占い師詳細などの画面を重ねて表示するため Stack にする。
  // ヘッダーは各画面で必要になった時点で出す
  return <Stack screenOptions={{ headerShown: false }} />;
}
