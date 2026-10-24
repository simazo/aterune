import { logger } from '@/lib/logger';
import { dismissPushNotifications } from '@/lib/push-notifications';
import { supabase } from '@/lib/supabase';
import { Platform } from 'react-native';
import { deletePushTokenForCurrentDevice } from './push-tokens';

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

export async function signInWithEmail(email: string, password: string) {
  return supabase.auth.signInWithPassword({ email, password });
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
  // push tokenの削除はログイン中にしか行えないため、signOutより先に実行する。
  // 削除に失敗してもログアウトは必ず行う
  try {
    await deletePushTokenForCurrentDevice();
  } catch (e) {
    // deletePushTokenForCurrentDeviceは例外を投げない作りのため、現状ここには来ない。
    // 今後その作りが変わってもログアウトを止めないよう、念のため残している
    logger.warn('push token削除中に例外:', e instanceof Error ? e.message : e);
  }
  // 通知欄の通知は OS が出しているため、ログアウトしても自分で消さないと残る
  await dismissPushNotifications();
  return supabase.auth.signOut();
}
