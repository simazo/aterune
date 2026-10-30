import type { PostgrestError } from '@supabase/supabase-js';

// お悩み投稿への応募（apply_to_consultation_post）を DB が弾いたときの、エラー文（error.message）ごとの日本語の文言。
// raise exception はどれも code が P0001 になるため、文で見分ける。文は次のマイグレーションと合わせる:
//   supabase/migrations/20261022230353_create_apply_to_consultation_post.sql（占い師でない・自分の投稿・存在しない投稿）
//   supabase/migrations/20261009214623_create_sessions.sql（閉じた投稿・二重の申込み・ブロック）
// 二重の申込みの文言からは、すでにやり取りしている相手の投稿だと分かるが、
// 応募が通っても投稿者は分かる仕様（一覧・詳細だけ匿名）なので、分かる範囲は変わらない
const CONSULTATION_APPLY_ERROR_MESSAGES: Record<string, string> = {
  'cannot apply to a closed post': 'このお悩みは閉じられたため、応募できません',
  'an open session already exists between the consultant and the teller':
    'この相談者とは、承認待ちか進行中のやり取りがあるため応募できません',
  'only tellers can apply to a post': '応募するには占い師の登録が必要です',
  'cannot apply to your own post': '自分のお悩みには応募できません',
  'the post does not exist': 'このお悩みは見つかりませんでした',
  // どちらかの向きのブロックがある。ブロックされたことは知らせないため、向きの分からない文言にする
  'cannot send a request to this user': 'この相手には申し込めません',
};

// 23505 は UNIQUE 制約（sessions_post_id_teller_id_key。同じお悩みへは1回だけ）の違反
const DUPLICATE_APPLICATION_MESSAGE = 'このお悩みにはすでに応募しています';

// 分からないエラーや、通信エラーなどの場合の文言
const FALLBACK_CONSULTATION_APPLY_ERROR_MESSAGE =
  '応募できませんでした。時間をおいて、もう一度お試しください';

export function getConsultationApplyErrorMessage(error: Pick<PostgrestError, 'code' | 'message'>) {
  if (error.code === '23505') return DUPLICATE_APPLICATION_MESSAGE;
  return (
    CONSULTATION_APPLY_ERROR_MESSAGES[error.message] ?? FALLBACK_CONSULTATION_APPLY_ERROR_MESSAGE
  );
}
