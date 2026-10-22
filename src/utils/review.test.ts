import type { SessionDetail } from '@/types';
import { canWriteReview } from './review';

const NOW = new Date('2026-10-23T03:00:00.000Z');

// 自分（me）が相談者で、1日前に完了したセッション。必要な列だけ上書きする
function makeSession(
  overrides: Partial<Pick<SessionDetail, 'status' | 'consultant_id' | 'completed_at'>> = {}
) {
  return {
    status: 'completed' as SessionDetail['status'],
    consultant_id: 'me',
    completed_at: '2026-10-22T03:00:00.000Z',
    ...overrides,
  };
}

describe('canWriteReview', () => {
  it('相談者が、完了から7日以内で、まだレビューしていなければ書ける', () => {
    expect(canWriteReview(makeSession(), 'me', false, NOW)).toBe(true);
  });

  it('占い師（相談者でない）なら書けない', () => {
    expect(canWriteReview(makeSession({ consultant_id: 'consultant-1' }), 'me', false, NOW)).toBe(
      false
    );
  });

  it('すでにレビューしていれば書けない', () => {
    expect(canWriteReview(makeSession(), 'me', true, NOW)).toBe(false);
  });

  it.each(['pending', 'active', 'rejected', 'expired', 'auto_completed'] as const)(
    '%s なら書けない（相談者が完了した completed だけ）',
    (status) => {
      expect(canWriteReview(makeSession({ status }), 'me', false, NOW)).toBe(false);
    }
  );

  it('完了日時が無ければ書けない', () => {
    expect(canWriteReview(makeSession({ completed_at: null }), 'me', false, NOW)).toBe(false);
  });

  it('完了からちょうど7日なら書けない（DB の期限より1瞬早く切れ扱いにする）', () => {
    expect(
      canWriteReview(makeSession({ completed_at: '2026-10-16T03:00:00.000Z' }), 'me', false, NOW)
    ).toBe(false);
  });

  it('完了から7日の1分前なら書ける', () => {
    expect(
      canWriteReview(makeSession({ completed_at: '2026-10-16T03:01:00.000Z' }), 'me', false, NOW)
    ).toBe(true);
  });
});
