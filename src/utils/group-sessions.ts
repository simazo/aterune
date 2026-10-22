import type { SessionDetail, SessionListItem } from '@/types';

// やり取りタブで見ている側（相談者として／占い師として）
export type SessionRole = 'consultant' | 'teller';

export type SessionSections = {
  // 自分が申込まれた側で、期限内の承認待ち（承認・拒否が必要）
  awaitingMyReply: SessionListItem[];
  active: SessionListItem[];
  // 自分が申込んだ側で、期限内の承認待ち
  awaitingTheirReply: SessionListItem[];
  // 完了・自動完了・拒否・期限切れ
  ended: SessionListItem[];
};

// 期限内の承認待ちか（承認・拒否できる状態か）。
// 期限ちょうどは、DB の承認・拒否のチェック（expires_at < now() なら弾く）より1瞬早く切れ扱いにして、承認できない申込みを出さない
export function isOpenPending(session: Pick<SessionListItem, 'status' | 'expires_at'>, now: Date) {
  return session.status === 'pending' && new Date(session.expires_at) > now;
}

// 占い師が、このセッションの相談者の生年月日・性別を見てよいか（相談者の同意がある状態か）。
// RLS（profile_private_details_select_teller_of_session）は相談者と占い師の組で判定し、セッション単位では絞らず、
// 承認待ちの期限も見ないため、画面ではこのセッションの状態で確かめてから取得・表示する
export function canSeeConsultantDetails(
  session: Pick<SessionDetail, 'status' | 'expires_at' | 'initiated_by'>,
  now: Date
) {
  return (
    session.status === 'active' ||
    session.status === 'completed' ||
    session.status === 'auto_completed' ||
    (isOpenPending(session, now) && session.initiated_by === 'consultant')
  );
}

// 自分のセッションのうち、指定した側のものをやり取りタブのセクションに仕分ける（並び順は元のまま）。
// 期限切れの pending を expired に更新する定期処理がまだ無いため、期限を過ぎた pending は期限切れとして「終了」に入れる
export function groupSessions(
  sessions: SessionListItem[],
  userId: string,
  role: SessionRole,
  now: Date
): SessionSections {
  const sections: SessionSections = {
    awaitingMyReply: [],
    active: [],
    awaitingTheirReply: [],
    ended: [],
  };

  for (const session of sessions) {
    const myId = role === 'consultant' ? session.consultant_id : session.teller_id;
    if (myId !== userId) continue;

    if (isOpenPending(session, now)) {
      if (session.recipient_id === userId) {
        sections.awaitingMyReply.push(session);
      } else {
        sections.awaitingTheirReply.push(session);
      }
    } else if (session.status === 'active') {
      sections.active.push(session);
    } else {
      sections.ended.push(session);
    }
  }

  return sections;
}
