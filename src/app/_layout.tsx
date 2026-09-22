import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { AuthScreen } from '@/components/auth-screen';
import { GluestackUIProvider } from '@/components/ui/gluestack-ui-provider';
import { useAuth } from '@/hooks/use-auth';
import { AuthProvider } from '@/providers/auth-provider';
import { DarkTheme, DefaultTheme, Slot, ThemeProvider, usePathname } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useColorScheme } from 'react-native';
import "../../global.css";

SplashScreen.preventAutoHideAsync();

function RootLayoutContent() {
  const colorScheme = useColorScheme();
  const pathname = usePathname();
  const { session, loading } = useAuth();

  // /auth配下のルート（メール確認完了画面など）は、ログイン状態に関わらず
  // そのルート自体をそのまま表示する。それ以外は従来通りAuthScreenで
  // ログイン/ログアウトを出し分ける。
  const isAuthCallbackRoute = pathname?.startsWith('/auth');

  return (
    <GluestackUIProvider mode="dark">
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <AnimatedSplashOverlay />
        {!loading && (isAuthCallbackRoute ? <Slot /> : <AuthScreen session={session} />)}
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