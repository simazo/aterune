import { supabase } from '@/lib/supabase';
import { reportUser } from './reports';

jest.mock('@/lib/supabase', () => ({
  supabase: { from: jest.fn() },
}));

const mockSupabase = jest.mocked(supabase);

// from('reports').insert() の呼び出しを記録するモック
function mockInsertQuery(result: { error: unknown }) {
  const query = { insert: jest.fn().mockResolvedValue(result) };
  mockSupabase.from.mockReturnValueOnce(query as never);
  return query;
}

beforeEach(() => {
  jest.resetAllMocks();
});

describe('reportUser', () => {
  it('セッション詳細からなら、セッションのIDも付けて通報を insert する', async () => {
    const query = mockInsertQuery({ error: null });

    const result = await reportUser({
      reporterId: 'user-1',
      reportedUserId: 'user-2',
      sessionId: 'session-1',
      reason: 'harassment',
      detail: '詳しい内容',
    });

    expect(mockSupabase.from).toHaveBeenCalledWith('reports');
    expect(query.insert).toHaveBeenCalledWith({
      reporter_id: 'user-1',
      reported_user_id: 'user-2',
      session_id: 'session-1',
      reason: 'harassment',
      detail: '詳しい内容',
    });
    expect(result).toEqual({ error: null });
  });

  it('占い師詳細から（セッションなし）なら、session_id を null で送る', async () => {
    const query = mockInsertQuery({ error: null });

    await reportUser({
      reporterId: 'user-1',
      reportedUserId: 'user-2',
      sessionId: null,
      reason: 'spam',
      detail: '詳しい内容',
    });

    expect(query.insert).toHaveBeenCalledWith(expect.objectContaining({ session_id: null }));
  });

  it('詳しい内容が空なら null で送る', async () => {
    const query = mockInsertQuery({ error: null });

    await reportUser({
      reporterId: 'user-1',
      reportedUserId: 'user-2',
      sessionId: null,
      reason: 'other',
      detail: '',
    });

    expect(query.insert).toHaveBeenCalledWith(expect.objectContaining({ detail: null }));
  });

  it('insert のエラーをそのまま返す', async () => {
    const error = { code: '42501', message: 'permission denied' };
    mockInsertQuery({ error });

    const result = await reportUser({
      reporterId: 'user-1',
      reportedUserId: 'user-2',
      sessionId: null,
      reason: 'spam',
      detail: '',
    });

    expect(result).toEqual({ error });
  });
});
