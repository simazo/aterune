import type { AuthError } from '@supabase/supabase-js';

// Supabase Auth のエラーコード（error.code）ごとの日本語の文言。
// 一覧は Supabase のドキュメント（Auth error codes）を参照
const AUTH_ERROR_MESSAGES: Record<string, string> = {
  invalid_credentials: 'メールアドレスまたはパスワードが正しくありません',
  email_not_confirmed:
    'メールアドレスの確認が完了していません。確認メールのリンクから登録を完了してください',
  // Confirm email が有効な環境では、登録済みのメールアドレスでもエラーは返らない（ユーザーの存在を隠すため）。
  // 無効にした環境（ローカルなど）では返るため残している
  user_already_exists: 'このメールアドレスはすでに登録されています',
  email_exists: 'このメールアドレスはすでに登録されています',
  weak_password: 'パスワードが簡単すぎます。別のパスワードを設定してください',
  same_password: '今と同じパスワードは設定できません。別のパスワードを入力してください',
  email_address_invalid: 'このメールアドレスは使用できません',
  over_email_send_rate_limit:
    'メールの送信回数が上限に達しました。しばらく時間をおいて、もう一度お試しください',
  over_request_rate_limit:
    '短時間に操作が集中しています。しばらく時間をおいて、もう一度お試しください',
  signup_disabled: '現在、新規登録を受け付けていません',
  user_banned: 'このアカウントは利用が停止されています',
};

// 分からないコードや、通信エラーなどで code が無い場合の文言
const FALLBACK_AUTH_ERROR_MESSAGE = 'エラーが発生しました。時間をおいて、もう一度お試しください';

export function getAuthErrorMessage(error: Pick<AuthError, 'code'>) {
  return (error.code && AUTH_ERROR_MESSAGES[error.code]) || FALLBACK_AUTH_ERROR_MESSAGE;
}
