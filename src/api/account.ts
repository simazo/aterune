import { logger } from '@/lib/logger';
import { dismissPushNotifications } from '@/lib/push-notifications';
import { supabase } from '@/lib/supabase';
import { FunctionsHttpError } from '@supabase/supabase-js';

export type DeleteAccountResult = { error: 'has_active_session' | 'failed' | null };

// 退会する（論理削除）。DB 側の処理と auth のユーザー削除は、Service Role Key が要るため Edge Function（delete-account）で行う。
// 成功したらサーバー側のセッションは消えているので、端末側のログイン状態だけを消す（scope: 'local'）。
// push token は Edge Function の中で消すので、ログアウトのように signOut の前に消す処理は要らない
export async function deleteAccount(): Promise<DeleteAccountResult> {
  const { error } = await supabase.functions.invoke('delete-account');
  if (error) {
    // 409 は進行中のセッションがあるとき（delete-account の has_active_session）
    if (error instanceof FunctionsHttpError && error.context?.status === 409) {
      return { error: 'has_active_session' };
    }
    return { error: 'failed' };
  }

  // 通知欄の通知は OS が出しているため、自分で消さないと残る
  await dismissPushNotifications();
  const { error: signOutError } = await supabase.auth.signOut({ scope: 'local' });
  // 退会は済んでいるので、呼び出し元には成功として返し、記録だけする
  if (signOutError) {
    logger.warn('退会後のログアウトのエラー:', signOutError.message);
  }
  return { error: null };
}
