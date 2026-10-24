import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

// Node.js環境（Web静的書き出しの事前レンダリング時）ではwindowが無いため、
// AsyncStorage(ブラウザのlocalStorage前提)の初期化を避ける
const isServer = typeof window === 'undefined';

export const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL!,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
  {
    auth: {
      storage: isServer ? undefined : AsyncStorage,
      autoRefreshToken: !isServer,
      persistSession: !isServer,
      detectSessionInUrl: false,
    },
  }
);

// ブラウザ以外ではライブラリがアプリの前面・背面を判断できず、トークンの自動更新が
// バックグラウンドでも動き続けるため、前面にあるときだけ動かす（auth-js の startAutoRefresh の説明と、
// 公式の例 supabase/supabase の examples/auth/quickstarts/react-native/lib/supabase.ts に従う）。
// Web（事前レンダリングを含む）はライブラリが visibilitychange で切り替えるので登録しない。
// モジュールの読み込み時に1回だけ登録する
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') {
      supabase.auth.startAutoRefresh();
    } else {
      supabase.auth.stopAutoRefresh();
    }
  });
}