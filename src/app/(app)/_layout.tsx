import { useAuth } from '@/hooks/use-auth';
import { Redirect, Stack } from 'expo-router';

// 占い師詳細などを URL から直接開いたとき（Web の再読み込み・ディープリンク）も、
// 下にタブ（(tabs)）を敷いて、ヘッダーに戻るボタンが出るようにする。
// async routes（app.json の asyncRoutes）を有効にすると、開発時はこの設定が効かない
export const unstable_settings = {
  anchor: '(tabs)',
};

export default function AppLayout() {
  const { session } = useAuth();

  if (!session) {
    return <Redirect href="/login" />;
  }

  // タブ（(tabs)）の上に、占い師詳細などの画面を重ねて表示するため Stack にする。
  // ヘッダーは各画面で必要になった時点で出す
  return <Stack screenOptions={{ headerShown: false }} />;
}
