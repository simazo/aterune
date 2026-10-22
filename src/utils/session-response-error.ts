// 承認・拒否で、更新できる承認待ちの行が無かったとき（相手が先に処理した、すでに処理済みなど）に
// api/sessions.ts が返すエラー文。api と画面の両方で使うため、外部に依存しない utils に置く
export const SESSION_ALREADY_HANDLED_MESSAGE = 'the session request has already been handled';

// 申込みの承認・拒否が失敗したときのエラー文（error.message）ごとの日本語の文言。
// 期限切れの文は supabase/migrations/20261009214623_create_sessions.sql の guard_session_status_change と合わせる
// （承認・拒否とも同じ文）。処理済みは api/sessions.ts が更新した行が無いときに返す
const SESSION_RESPONSE_ERROR_MESSAGES: Record<string, string> = {
  'the session request has expired': '申込みの期限が切れています',
  [SESSION_ALREADY_HANDLED_MESSAGE]: 'この申込みはすでに処理されています',
};

// 分からないエラーや、通信エラーなどの場合の文言
const FALLBACK_SESSION_RESPONSE_ERROR_MESSAGE =
  '処理できませんでした。時間をおいて、もう一度お試しください';

export function getSessionResponseErrorMessage(error: { message: string }) {
  return SESSION_RESPONSE_ERROR_MESSAGES[error.message] ?? FALLBACK_SESSION_RESPONSE_ERROR_MESSAGE;
}
