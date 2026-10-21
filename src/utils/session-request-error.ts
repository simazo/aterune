import type { PostgrestError } from '@supabase/supabase-js';

// 申込み（sessions への insert）を DB のトリガーが弾いたときのエラー文（error.message）ごとの日本語の文言。
// トリガーの raise exception はどれも code が P0001 になるため、文で見分ける。
// 文は supabase/migrations/20261009214623_create_sessions.sql の check_session_request と合わせる
const SESSION_REQUEST_ERROR_MESSAGES: Record<string, string> = {
  'the teller is not accepting session requests': 'この占い師は現在、申込みを受け付けていません',
  "the teller requires the consultant's birthdate":
    'この占い師への申込みには生年月日の登録が必要です',
  'an open session already exists between the consultant and the teller':
    'この占い師にはすでに申し込んでいます',
};

// 分からないエラーや、通信エラーなどの場合の文言
const FALLBACK_SESSION_REQUEST_ERROR_MESSAGE =
  '申し込めませんでした。時間をおいて、もう一度お試しください';

export function getSessionRequestErrorMessage(error: Pick<PostgrestError, 'message'>) {
  return SESSION_REQUEST_ERROR_MESSAGES[error.message] ?? FALLBACK_SESSION_REQUEST_ERROR_MESSAGE;
}
