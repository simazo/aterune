import { supabase } from '@/lib/supabase';
import { createSessionRequest, hasOpenSessionWithTeller } from './sessions';

jest.mock('@/lib/supabase', () => ({
  supabase: { from: jest.fn() },
}));

const mockSupabase = jest.mocked(supabase);

// from('sessions').insert() の呼び出しを記録するモック
function mockInsert(result: { error: unknown }) {
  const query = { insert: jest.fn().mockResolvedValue(result) };
  mockSupabase.from.mockReturnValue(query as never);
  return query;
}

// from('sessions').select().eq().eq().or().limit() の呼び出しを記録するモック
function mockOpenSessionQuery(result: { data: unknown; error: unknown }) {
  const query = {
    select: jest.fn(),
    eq: jest.fn(),
    or: jest.fn(),
    limit: jest.fn().mockResolvedValue(result),
  };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.or.mockReturnValue(query);
  mockSupabase.from.mockReturnValue(query as never);
  return query;
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('createSessionRequest', () => {
  it('相談者から占い師への申込みとして、自分を申込者・相談者、占い師を申込まれた側にして登録する', async () => {
    const query = mockInsert({ error: null });

    await createSessionRequest({
      consultantId: 'user-1',
      tellerId: 'teller-1',
      concern: '仕事の悩み',
      message: 'よろしくお願いします',
    });

    expect(mockSupabase.from).toHaveBeenCalledWith('sessions');
    expect(query.insert).toHaveBeenCalledWith({
      applicant_id: 'user-1',
      recipient_id: 'teller-1',
      consultant_id: 'user-1',
      teller_id: 'teller-1',
      initiated_by: 'consultant',
      concern: '仕事の悩み',
      applicant_message: 'よろしくお願いします',
    });
  });

  it('ひとことが空ならnullで登録する', async () => {
    const query = mockInsert({ error: null });

    await createSessionRequest({
      consultantId: 'user-1',
      tellerId: 'teller-1',
      concern: '仕事の悩み',
      message: '',
    });

    expect(query.insert).toHaveBeenCalledWith(
      expect.objectContaining({ applicant_message: null })
    );
  });

  it('登録に失敗したらerrorをそのまま返す', async () => {
    const error = { message: 'the teller is not accepting session requests' };
    mockInsert({ error });

    const result = await createSessionRequest({
      consultantId: 'user-1',
      tellerId: 'teller-1',
      concern: '仕事の悩み',
      message: '',
    });

    expect(result).toEqual({ error });
  });
});

describe('hasOpenSessionWithTeller', () => {
  beforeEach(() => {
    jest.useFakeTimers({ now: new Date('2026-10-20T03:00:00.000Z') });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('自分と占い師の間の、進行中か期限内の承認待ちのセッションを探す', async () => {
    const query = mockOpenSessionQuery({ data: [], error: null });

    await hasOpenSessionWithTeller('user-1', 'teller-1');

    expect(mockSupabase.from).toHaveBeenCalledWith('sessions');
    expect(query.eq).toHaveBeenCalledWith('consultant_id', 'user-1');
    expect(query.eq).toHaveBeenCalledWith('teller_id', 'teller-1');
    expect(query.or).toHaveBeenCalledWith(
      'status.eq.active,and(status.eq.pending,expires_at.gt.2026-10-20T03:00:00.000Z)'
    );
    expect(query.limit).toHaveBeenCalledWith(1);
  });

  it('該当するセッションがあればtrueを返す', async () => {
    mockOpenSessionQuery({ data: [{ id: 'session-1' }], error: null });

    const result = await hasOpenSessionWithTeller('user-1', 'teller-1');

    expect(result).toEqual({ data: true, error: null });
  });

  it('該当するセッションが無ければfalseを返す', async () => {
    mockOpenSessionQuery({ data: [], error: null });

    const result = await hasOpenSessionWithTeller('user-1', 'teller-1');

    expect(result).toEqual({ data: false, error: null });
  });

  it('呼び出しに失敗したらdataをnullにしてerrorを返す', async () => {
    const error = { message: 'network error' };
    mockOpenSessionQuery({ data: null, error });

    const result = await hasOpenSessionWithTeller('user-1', 'teller-1');

    expect(result).toEqual({ data: null, error });
  });
});
