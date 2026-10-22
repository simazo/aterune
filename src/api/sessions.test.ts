import { supabase } from '@/lib/supabase';
import { createSessionRequest, hasOpenSessionWithTeller, listMySessions } from './sessions';

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

// from('sessions').select().or().order() の呼び出しを記録するモック（1回目の from 用）
function mockMySessionsQuery(result: { data: unknown; error: unknown }) {
  const query = {
    select: jest.fn(),
    or: jest.fn(),
    order: jest.fn().mockResolvedValue(result),
  };
  query.select.mockReturnValue(query);
  query.or.mockReturnValue(query);
  mockSupabase.from.mockReturnValueOnce(query as never);
  return query;
}

// from('profiles').select().in() の呼び出しを記録するモック（2回目の from 用）
function mockPartnerProfilesQuery(result: { data: unknown; error: unknown }) {
  const query = {
    select: jest.fn(),
    in: jest.fn().mockResolvedValue(result),
  };
  query.select.mockReturnValue(query);
  mockSupabase.from.mockReturnValueOnce(query as never);
  return query;
}

beforeEach(() => {
  jest.resetAllMocks();
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

describe('listMySessions', () => {
  // 自分（user-1）が申込んだセッションと、申込まれたセッション
  const sessions = [
    {
      id: 'session-1',
      applicant_id: 'user-1',
      recipient_id: 'teller-1',
      consultant_id: 'user-1',
      teller_id: 'teller-1',
      status: 'pending',
      concern: '仕事の悩み',
      expires_at: '2026-10-24T03:00:00.000Z',
      updated_at: '2026-10-22T03:00:00.000Z',
    },
    {
      id: 'session-2',
      applicant_id: 'teller-1',
      recipient_id: 'user-1',
      consultant_id: 'user-1',
      teller_id: 'teller-1',
      status: 'rejected',
      concern: '恋愛の悩み',
      expires_at: '2026-10-23T03:00:00.000Z',
      updated_at: '2026-10-21T03:00:00.000Z',
    },
    {
      id: 'session-3',
      applicant_id: 'consultant-1',
      recipient_id: 'user-1',
      consultant_id: 'consultant-1',
      teller_id: 'user-1',
      status: 'active',
      concern: '家族の悩み',
      expires_at: '2026-10-22T03:00:00.000Z',
      updated_at: '2026-10-20T03:00:00.000Z',
    },
  ];

  it('自分が申込んだ側か申込まれた側のセッションを、更新の新しい順に取得する', async () => {
    const query = mockMySessionsQuery({ data: [], error: null });

    await listMySessions('user-1');

    expect(mockSupabase.from).toHaveBeenCalledWith('sessions');
    expect(query.select).toHaveBeenCalledWith(
      'id, applicant_id, recipient_id, consultant_id, teller_id, status, concern, expires_at, updated_at'
    );
    expect(query.or).toHaveBeenCalledWith('applicant_id.eq.user-1,recipient_id.eq.user-1');
    expect(query.order).toHaveBeenCalledWith('updated_at', { ascending: false });
  });

  it('相手のプロフィールを重複なく取得し、各セッションに相手の表示名を付けて返す', async () => {
    mockMySessionsQuery({ data: sessions, error: null });
    const profilesQuery = mockPartnerProfilesQuery({
      data: [
        { id: 'teller-1', display_name: '星読みミカ' },
        { id: 'consultant-1', display_name: 'さくら' },
      ],
      error: null,
    });

    const result = await listMySessions('user-1');

    expect(mockSupabase.from).toHaveBeenNthCalledWith(2, 'profiles');
    expect(profilesQuery.select).toHaveBeenCalledWith('id, display_name');
    expect(profilesQuery.in).toHaveBeenCalledWith('id', ['teller-1', 'consultant-1']);
    expect(result).toEqual({
      data: [
        { ...sessions[0], partner_name: '星読みミカ' },
        { ...sessions[1], partner_name: '星読みミカ' },
        { ...sessions[2], partner_name: 'さくら' },
      ],
      error: null,
    });
  });

  it('相手のプロフィールが見つからなければ表示名をnullにする', async () => {
    mockMySessionsQuery({ data: [sessions[0]], error: null });
    mockPartnerProfilesQuery({ data: [], error: null });

    const result = await listMySessions('user-1');

    expect(result).toEqual({ data: [{ ...sessions[0], partner_name: null }], error: null });
  });

  it('セッションが無ければプロフィールを取得せずに空の配列を返す', async () => {
    mockMySessionsQuery({ data: [], error: null });

    const result = await listMySessions('user-1');

    expect(mockSupabase.from).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ data: [], error: null });
  });

  it('セッションの取得に失敗したらdataをnullにしてerrorを返す', async () => {
    const error = { message: 'network error' };
    mockMySessionsQuery({ data: null, error });

    const result = await listMySessions('user-1');

    expect(mockSupabase.from).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ data: null, error });
  });

  it('相手のプロフィールの取得に失敗したらdataをnullにしてerrorを返す', async () => {
    const error = { message: 'network error' };
    mockMySessionsQuery({ data: sessions, error: null });
    mockPartnerProfilesQuery({ data: null, error });

    const result = await listMySessions('user-1');

    expect(result).toEqual({ data: null, error });
  });
});
