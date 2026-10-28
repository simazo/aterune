import { Slot } from 'expo-router';

// ルートのレイアウト（src/app/_layout.tsx）が描画するナビゲーター。
// レイアウトは AuthProvider などを含んでいてテストで読み込めないため、この部分だけを切り出し、
// レイアウトのテスト（src/__tests__/layouts.test.tsx）からも同じものを使う
export function RootNavigator() {
  return <Slot />;
}
