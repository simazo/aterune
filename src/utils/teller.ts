// 完了したセッションがこの回数未満の占い師を「新人」として表示する
export const NEWCOMER_SESSION_THRESHOLD = 5;

export function isNewcomer(sessionCount: number) {
  return sessionCount < NEWCOMER_SESSION_THRESHOLD;
}
