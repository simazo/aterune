import { GluestackUIProvider } from '@/components/ui/gluestack-ui-provider';
import { useAuth } from '@/hooks/use-auth';
import { DARK_NAVIGATION_THEME, LIGHT_NAVIGATION_THEME } from '@/lib/navigation-theme';
import { AuthProvider } from '@/providers/auth-provider';
import { Slot, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { useColorScheme } from 'react-native';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import "../../global.css";

SplashScreen.preventAutoHideAsync();

function RootLayoutContent() {
  const colorScheme = useColorScheme();
  const { loading } = useAuth();

  // ログイン状態の読み込みが終わるまでは OS のスプラッシュを出したままにし、何も無い画面を見せない
  // （読み込みは失敗しても AuthProvider が終わらせるので、閉じないまま残ることは無い）
  useEffect(() => {
    if (!loading) {
      SplashScreen.hide();
    }
  }, [loading]);

  // 認証状態に応じたリダイレクトは(auth)/(app)各グループのレイアウトが担当する。
  // /auth配下（メール確認完了画面など）はどちらのグループにも属さないため、
  // 認証状態に関わらずそのまま表示される。
  // 配色は、画面の中身（gluestack）とヘッダー・タブバー（react-navigation）のどちらも OS の設定に合わせる。
  return (
    <GluestackUIProvider mode="system">
      <ThemeProvider value={colorScheme === 'dark' ? DARK_NAVIGATION_THEME : LIGHT_NAVIGATION_THEME}>
        {!loading && <Slot />}
      </ThemeProvider>
    </GluestackUIProvider>
  );
}

// KeyboardProvider は、入力欄のある画面の KeyboardAwareScrollView（@/components/keyboard-aware-scroll-view）に必要
export default function RootLayout() {
  return (
    <KeyboardProvider>
      <AuthProvider>
        <RootLayoutContent />
      </AuthProvider>
    </KeyboardProvider>
  );
}