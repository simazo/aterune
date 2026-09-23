import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { GluestackUIProvider } from '@/components/ui/gluestack-ui-provider';
import { useAuth } from '@/hooks/use-auth';
import { AuthProvider } from '@/providers/auth-provider';
import { DarkTheme, DefaultTheme, Slot, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useColorScheme } from 'react-native';
import "../../global.css";

SplashScreen.preventAutoHideAsync();

function RootLayoutContent() {
  const colorScheme = useColorScheme();
  const { loading } = useAuth();

  // 認証状態に応じたリダイレクトは(auth)/(app)各グループのレイアウトが担当する。
  // /auth配下（メール確認完了画面など）はどちらのグループにも属さないため、
  // 認証状態に関わらずそのまま表示される。
  return (
    <GluestackUIProvider mode="dark">
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <AnimatedSplashOverlay />
        {!loading && <Slot />}
      </ThemeProvider>
    </GluestackUIProvider>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <RootLayoutContent />
    </AuthProvider>
  );
}