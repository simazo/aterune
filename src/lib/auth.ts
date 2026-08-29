import { Platform } from 'react-native';
import { supabase } from './supabase';

// Web版のconfirm email redirect先。現状はテスト用のVercel URL。
// 本番ドメイン確定後、または実際のWeb版画面が用意できたタイミングで差し替える。
const WEB_AUTH_REDIRECT_URL = 'https://aterune-auth-test.vercel.app';
const MOBILE_AUTH_REDIRECT_URL = 'aterune://auth/confirmed';

export async function signUpWithEmail(email: string, password: string, displayName: string) {
  const emailRedirectTo = Platform.OS === 'web' ? WEB_AUTH_REDIRECT_URL : MOBILE_AUTH_REDIRECT_URL;

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { display_name: displayName },
      emailRedirectTo,
    },
  });

  return { data, error };
}