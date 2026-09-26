import { Platform } from 'react-native';
import { deletePushTokenForCurrentDevice } from './pushToken';
import { supabase } from './supabase';

const MOBILE_AUTH_REDIRECT_URL = 'aterune://auth/confirmed';

// 確認メールのリンクの戻り先。Web版は今開いているオリジン（開発中はlocalhost、本番は本番ドメイン）の
// /auth/confirmed に戻す。どのオリジンもSupabaseダッシュボードのRedirect URLs許可リストへの登録が必要。
function getEmailRedirectTo() {
  if (Platform.OS === 'web') {
    return `${window.location.origin}/auth/confirmed`;
  }
  return MOBILE_AUTH_REDIRECT_URL;
}

export async function signUpWithEmail(email: string, password: string, displayName: string) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { display_name: displayName },
      emailRedirectTo: getEmailRedirectTo(),
    },
  });

  return { data, error };
}

export type EmailConfirmationResult =
  | { status: 'success' }
  | { status: 'error'; errorCode: string | null }
  | { status: 'no-params' };

// 確認メールのリンクから戻ってきたURLを読み取り、成功ならセッションを確立する。
// supabase.tsでdetectSessionInUrl: falseにしているため、URLの処理はここで明示的に行う。
export async function createSessionFromUrl(url: string): Promise<EmailConfirmationResult> {
  const params = parseAuthParams(url);

  const error = params.get('error');
  if (error) {
    return { status: 'error', errorCode: params.get('error_code') };
  }

  const accessToken = params.get('access_token');
  const refreshToken = params.get('refresh_token');
  if (!accessToken || !refreshToken) {
    return { status: 'no-params' };
  }

  const { error: sessionError } = await supabase.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  });
  if (sessionError) {
    return { status: 'error', errorCode: sessionError.code ?? null };
  }

  return { status: 'success' };
}

// implicitフロー（supabase-jsのデフォルト）では結果がURLフラグメント(#以降)に付く。
// 念のためクエリ(?以降)も読み、両方をまとめて返す。
function parseAuthParams(url: string) {
  const [beforeHash, hash = ''] = url.split('#');
  const query = beforeHash.split('?')[1] ?? '';
  return new URLSearchParams([query, hash].filter(Boolean).join('&'));
}

export async function signOut() {
  // push tokenの削除はログイン中にしか行えないため、signOutより先に実行する
  await deletePushTokenForCurrentDevice();
  return supabase.auth.signOut();
}
