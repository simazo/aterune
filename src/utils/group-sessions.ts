import type { SessionListItem } from '@/types';

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

// 自分のセッションのうち、指定した側のものをやり取りタブのセクションに仕分ける（並び順は元のまま）。
// 期限切れの pending を expired に更新する定期処理がまだ無いため、期限を過ぎた pending は期限切れとして「終了」に入れる。
// 期限ちょうどは、DB の承認のチェック（expires_at < now() なら弾く）より1瞬早く切れ扱いにして、承認できない申込みを出さない
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

    if (session.status === 'pending' && new Date(session.expires_at) > now) {
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
