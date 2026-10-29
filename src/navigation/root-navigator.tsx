import { Stack } from 'expo-router';

// ルートのレイアウト（src/app/_layout.tsx）が描画するナビゲーター。
// レイアウトは AuthProvider などを含んでいてテストで読み込めないため、この部分だけを切り出し、
// レイアウトのテスト（src/__tests__/layouts.test.tsx）からも同じものを使う。
// どちらのグループにも入らない画面（利用規約など）を元の画面の上に重ね、戻ると元の画面（入力も含む）に戻れるよう Stack にする
export function RootNavigator() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      {/* ログイン・ログアウトで (auth) と (app) が入れ替わるときは、アニメーションを付けない */}
      <Stack.Screen name="(auth)" options={{ animation: 'none' }} />
      <Stack.Screen name="(app)" options={{ animation: 'none' }} />
    </Stack>
  );
}
