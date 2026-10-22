import type { SessionListItem } from '@/types';
import { canSeeConsultantDetails, groupSessions, isOpenPending } from './group-sessions';

const NOW = new Date('2026-10-22T03:00:00.000Z');
const FUTURE = '2026-10-23T03:00:00.000Z';
const PAST = '2026-10-21T03:00:00.000Z';

// 自分（me）が相談者、占い師（teller-1）が相手のセッションを作る。必要な列だけ上書きする
function makeSession(overrides: Partial<SessionListItem>): SessionListItem {
  return {
    id: 'session',
    applicant_id: 'me',
    recipient_id: 'teller-1',
    consultant_id: 'me',
    teller_id: 'teller-1',
    status: 'pending',
    concern: '悩み',
    expires_at: FUTURE,
    updated_at: '2026-10-22T00:00:00.000Z',
    partner_name: '相手',
    ...overrides,
  };
}

// 自分（me）が占い師、相談者（consultant-1）が相手のセッション
function makeTellerSession(overrides: Partial<SessionListItem>): SessionListItem {
  return makeSession({
    applicant_id: 'consultant-1',
    recipient_id: 'me',
    consultant_id: 'consultant-1',
    teller_id: 'me',
    ...overrides,
  });
}

function ids(sessions: SessionListItem[]) {
  return sessions.map((s) => s.id);
}

describe('groupSessions', () => {
  it('相談者としてなら、自分が相談者のセッションだけを仕分ける', () => {
    const sessions = [
      makeSession({ id: 'as-consultant', status: 'active' }),
      makeTellerSession({ id: 'as-teller', status: 'active' }),
    ];

    const result = groupSessions(sessions, 'me', 'consultant', NOW);

    expect(ids(result.active)).toEqual(['as-consultant']);
  });

  it('占い師としてなら、自分が占い師のセッションだけを仕分ける', () => {
    const sessions = [
      makeSession({ id: 'as-consultant', status: 'active' }),
      makeTellerSession({ id: 'as-teller', status: 'active' }),
    ];

    const result = groupSessions(sessions, 'me', 'teller', NOW);

    expect(ids(result.active)).toEqual(['as-teller']);
  });

  it('期限内の承認待ちは、自分が申込まれた側なら「あなたの返事待ち」、申込んだ側なら「相手の返事待ち」に入れる', () => {
    const sessions = [
      makeTellerSession({ id: 'received' }),
      makeTellerSession({
        id: 'sent',
        applicant_id: 'me',
        recipient_id: 'consultant-1',
      }),
    ];

    const result = groupSessions(sessions, 'me', 'teller', NOW);

    expect(ids(result.awaitingMyReply)).toEqual(['received']);
    expect(ids(result.awaitingTheirReply)).toEqual(['sent']);
  });

  it('期限を過ぎた承認待ちは、どちらの側でも「終了」に入れる', () => {
    const sessions = [
      makeTellerSession({ id: 'received', expires_at: PAST }),
      makeTellerSession({
        id: 'sent',
        applicant_id: 'me',
        recipient_id: 'consultant-1',
        expires_at: PAST,
      }),
    ];

    const result = groupSessions(sessions, 'me', 'teller', NOW);

    expect(result.awaitingMyReply).toEqual([]);
    expect(result.awaitingTheirReply).toEqual([]);
    expect(ids(result.ended)).toEqual(['received', 'sent']);
  });

  it('期限ちょうどの承認待ちは期限切れとして「終了」に入れる', () => {
    const sessions = [makeTellerSession({ id: 'just', expires_at: NOW.toISOString() })];

    const result = groupSessions(sessions, 'me', 'teller', NOW);

    expect(result.awaitingMyReply).toEqual([]);
    expect(ids(result.ended)).toEqual(['just']);
  });

  it('完了・自動完了・拒否・期限切れは「終了」に、元の並び順のまま入れる', () => {
    const sessions = [
      makeSession({ id: 'completed', status: 'completed' }),
      makeSession({ id: 'auto_completed', status: 'auto_completed' }),
      makeSession({ id: 'rejected', status: 'rejected' }),
      makeSession({ id: 'expired', status: 'expired' }),
    ];

    const result = groupSessions(sessions, 'me', 'consultant', NOW);

    expect(ids(result.ended)).toEqual(['completed', 'auto_completed', 'rejected', 'expired']);
    expect(result.active).toEqual([]);
    expect(result.awaitingMyReply).toEqual([]);
    expect(result.awaitingTheirReply).toEqual([]);
  });
});

describe('isOpenPending', () => {
  it('期限内の承認待ちならtrueを返す', () => {
    expect(isOpenPending({ status: 'pending', expires_at: FUTURE }, NOW)).toBe(true);
  });

  it('期限を過ぎた承認待ちならfalseを返す', () => {
    expect(isOpenPending({ status: 'pending', expires_at: PAST }, NOW)).toBe(false);
  });

  it('期限ちょうどの承認待ちはfalseを返す（DB が弾く直前に切れ扱いにする）', () => {
    expect(isOpenPending({ status: 'pending', expires_at: NOW.toISOString() }, NOW)).toBe(false);
  });

  it('承認待ちでなければ期限内でもfalseを返す', () => {
    expect(isOpenPending({ status: 'active', expires_at: FUTURE }, NOW)).toBe(false);
  });
});

describe('canSeeConsultantDetails', () => {
  test.each(['active', 'completed', 'auto_completed'] as const)(
    '%s なら（申込みの起点に関係なく）見られる',
    (status) => {
      expect(
        canSeeConsultantDetails({ status, expires_at: PAST, initiated_by: 'teller' }, NOW)
      ).toBe(true);
    }
  );

  it('相談者から申込んだ期限内の承認待ちなら見られる', () => {
    expect(
      canSeeConsultantDetails(
        { status: 'pending', expires_at: FUTURE, initiated_by: 'consultant' },
        NOW
      )
    ).toBe(true);
  });

  it('占い師から応募した承認待ちは見られない（相談者がまだ同意していない）', () => {
    expect(
      canSeeConsultantDetails({ status: 'pending', expires_at: FUTURE, initiated_by: 'teller' }, NOW)
    ).toBe(false);
  });

  it('相談者から申込んだ承認待ちでも、期限を過ぎていれば見られない', () => {
    expect(
      canSeeConsultantDetails(
        { status: 'pending', expires_at: PAST, initiated_by: 'consultant' },
        NOW
      )
    ).toBe(false);
  });

  test.each(['rejected', 'expired'] as const)('%s なら見られない', (status) => {
    expect(
      canSeeConsultantDetails({ status, expires_at: FUTURE, initiated_by: 'consultant' }, NOW)
    ).toBe(false);
  });
});
