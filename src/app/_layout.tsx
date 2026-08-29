import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { AuthScreen } from '@/components/auth-screen';
import { GluestackUIProvider } from '@/components/ui/gluestack-ui-provider';
import { supabase } from '@/lib/supabase';
import type { Session } from '@supabase/supabase-js';
import { DarkTheme, DefaultTheme, Slot, ThemeProvider, usePathname } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { useColorScheme } from 'react-native';
import "../../global.css";

SplashScreen.preventAutoHideAsync();

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const pathname = usePathname();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

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