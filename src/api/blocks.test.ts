import { supabase } from '@/lib/supabase';
import { blockUser, isBlocking, listBlockedUsers, unblockUser } from './blocks';

jest.mock('@/lib/supabase', () => ({
  supabase: { from: jest.fn(), rpc: jest.fn() },
}));

const mockSupabase = jest.mocked(supabase);

// from('blocks').select().eq().eq().maybeSingle() の呼び出しを記録するモック
function mockSelectQuery(result: { data: unknown; error: unknown }) {
  const query = {
    select: jest.fn(),
    eq: jest.fn(),
    maybeSingle: jest.fn().mockResolvedValue(result),
  };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  mockSupabase.from.mockReturnValueOnce(query as never);
  return query;
}

// from('blocks').insert() の呼び出しを記録するモック
function mockInsertQuery(result: { error: unknown }) {
  const query = { insert: jest.fn().mockResolvedValue(result) };
  mockSupabase.from.mockReturnValueOnce(query as never);
  return query;
}

// from('blocks').delete().eq().eq() の呼び出しを記録するモック（2つ目の eq で結果を返す）
function mockDeleteQuery(result: { error: unknown }) {
  const query = {
    delete: jest.fn(),
    eq: jest.fn(),
  };
  query.delete.mockReturnValue(query);
  query.eq.mockReturnValueOnce(query).mockResolvedValueOnce(result);
  mockSupabase.from.mockReturnValueOnce(query as never);
  return query;
}

beforeEach(() => {
  jest.resetAllMocks();
});

describe('isBlocking', () => {
  it('自分がブロックした側として相手で絞り込み、行があればtrueを返す', async () => {
    const query = mockSelectQuery({ data: { blocked_id: 'user-2' }, error: null });

    const result = await isBlocking('user-1', 'user-2');

    expect(mockSupabase.from).toHaveBeenCalledWith('blocks');
    expect(query.select).toHaveBeenCalledWith('blocked_id');
    expect(query.eq).toHaveBeenCalledWith('blocker_id', 'user-1');
    expect(query.eq).toHaveBeenCalledWith('blocked_id', 'user-2');
    expect(result).toEqual({ data: true, error: null });
  });

  it('行が無ければfalseを返す', async () => {
    mockSelectQuery({ data: null, error: null });

    const result = await isBlocking('user-1', 'user-2');

    expect(result).toEqual({ data: false, error: null });
  });

  it('取得に失敗したらerrorをそのまま返す', async () => {
    const error = { message: 'network error' };
    mockSelectQuery({ data: null, error });

    const result = await isBlocking('user-1', 'user-2');

    expect(result).toEqual({ data: false, error });
  });
});

describe('blockUser', () => {
  it('自分をブロックした側として相手をブロックする', async () => {
    const query = mockInsertQuery({ error: null });

    const result = await blockUser('user-1', 'user-2');

    expect(mockSupabase.from).toHaveBeenCalledWith('blocks');
    expect(query.insert).toHaveBeenCalledWith({ blocker_id: 'user-1', blocked_id: 'user-2' });
    expect(result).toEqual({ error: null });
  });

  it('ブロック済み（23505）なら成功として返す', async () => {
    mockInsertQuery({ error: { code: '23505', message: 'duplicate key value' } });

    const result = await blockUser('user-1', 'user-2');

    expect(result).toEqual({ error: null });
  });

  it('それ以外のエラーはそのまま返す', async () => {
    const error = { code: '23514', message: 'violates check constraint "blocks_not_self_check"' };
    mockInsertQuery({ error });

    const result = await blockUser('user-1', 'user-1');

    expect(result).toEqual({ error });
  });
});

describe('unblockUser', () => {
  it('自分がブロックした側として相手で絞り込んで削除する', async () => {
    const query = mockDeleteQuery({ error: null });

    const result = await unblockUser('user-1', 'user-2');

    expect(mockSupabase.from).toHaveBeenCalledWith('blocks');
    expect(query.delete).toHaveBeenCalled();
    expect(query.eq).toHaveBeenCalledWith('blocker_id', 'user-1');
    expect(query.eq).toHaveBeenCalledWith('blocked_id', 'user-2');
    expect(result).toEqual({ error: null });
  });

  it('削除に失敗したらerrorをそのまま返す', async () => {
    const error = { message: 'network error' };
    mockDeleteQuery({ error });

    const result = await unblockUser('user-1', 'user-2');

    expect(result).toEqual({ error });
  });
});

describe('listBlockedUsers', () => {
  it('list_blocked_usersを呼び、結果を返す', async () => {
    const blockedUser = {
      blocked_id: 'user-2',
      display_name: '相手',
      avatar_path: null,
      created_at: '2026-10-30T00:00:00+00:00',
    };
    mockSupabase.rpc.mockResolvedValue({ data: [blockedUser], error: null } as never);

    const result = await listBlockedUsers();

    expect(mockSupabase.rpc).toHaveBeenCalledWith('list_blocked_users');
    expect(result).toEqual({ data: [blockedUser], error: null });
  });

  it('呼び出しに失敗したらerrorをそのまま返す', async () => {
    const error = { message: 'network error' };
    mockSupabase.rpc.mockResolvedValue({ data: null, error } as never);

    const result = await listBlockedUsers();

    expect(result).toEqual({ data: null, error });
  });
});
