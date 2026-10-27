import { supabase } from '@/lib/supabase';
import { addFavorite, isFavoriteTeller, listFavoriteTellers, removeFavorite } from './favorites';

jest.mock('@/lib/supabase', () => ({
  supabase: { from: jest.fn(), rpc: jest.fn() },
}));

const mockSupabase = jest.mocked(supabase);

// from('favorites').select().eq().eq().maybeSingle() の呼び出しを記録するモック
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

// from('favorites').insert() の呼び出しを記録するモック
function mockInsertQuery(result: { error: unknown }) {
  const query = { insert: jest.fn().mockResolvedValue(result) };
  mockSupabase.from.mockReturnValueOnce(query as never);
  return query;
}

// from('favorites').delete().eq().eq() の呼び出しを記録するモック（2つ目の eq で結果を返す）
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

describe('isFavoriteTeller', () => {
  it('自分と占い師の組み合わせで絞り込み、行があればtrueを返す', async () => {
    const query = mockSelectQuery({ data: { teller_id: 'teller-1' }, error: null });

    const result = await isFavoriteTeller('user-1', 'teller-1');

    expect(mockSupabase.from).toHaveBeenCalledWith('favorites');
    expect(query.select).toHaveBeenCalledWith('teller_id');
    expect(query.eq).toHaveBeenCalledWith('consultant_id', 'user-1');
    expect(query.eq).toHaveBeenCalledWith('teller_id', 'teller-1');
    expect(result).toEqual({ data: true, error: null });
  });

  it('行が無ければfalseを返す', async () => {
    mockSelectQuery({ data: null, error: null });

    const result = await isFavoriteTeller('user-1', 'teller-1');

    expect(result).toEqual({ data: false, error: null });
  });

  it('取得に失敗したらerrorをそのまま返す', async () => {
    const error = { message: 'network error' };
    mockSelectQuery({ data: null, error });

    const result = await isFavoriteTeller('user-1', 'teller-1');

    expect(result).toEqual({ data: false, error });
  });
});

describe('addFavorite', () => {
  it('自分を相談者として占い師をお気に入りに登録する', async () => {
    const query = mockInsertQuery({ error: null });

    const result = await addFavorite('user-1', 'teller-1');

    expect(mockSupabase.from).toHaveBeenCalledWith('favorites');
    expect(query.insert).toHaveBeenCalledWith({ consultant_id: 'user-1', teller_id: 'teller-1' });
    expect(result).toEqual({ error: null });
  });

  it('登録済み（23505）なら成功として返す', async () => {
    mockInsertQuery({ error: { code: '23505', message: 'duplicate key value' } });

    const result = await addFavorite('user-1', 'teller-1');

    expect(result).toEqual({ error: null });
  });

  it('それ以外のエラーはそのまま返す', async () => {
    const error = { code: '42501', message: 'permission denied' };
    mockInsertQuery({ error });

    const result = await addFavorite('user-1', 'teller-1');

    expect(result).toEqual({ error });
  });
});

describe('removeFavorite', () => {
  it('自分と占い師の組み合わせで絞り込んで削除する', async () => {
    const query = mockDeleteQuery({ error: null });

    const result = await removeFavorite('user-1', 'teller-1');

    expect(mockSupabase.from).toHaveBeenCalledWith('favorites');
    expect(query.delete).toHaveBeenCalled();
    expect(query.eq).toHaveBeenCalledWith('consultant_id', 'user-1');
    expect(query.eq).toHaveBeenCalledWith('teller_id', 'teller-1');
    expect(result).toEqual({ error: null });
  });

  it('削除に失敗したらerrorをそのまま返す', async () => {
    const error = { message: 'network error' };
    mockDeleteQuery({ error });

    const result = await removeFavorite('user-1', 'teller-1');

    expect(result).toEqual({ error });
  });
});

describe('listFavoriteTellers', () => {
  it('list_favorite_tellersを呼び、結果を返す', async () => {
    const teller = {
      teller_id: 'teller-1',
      display_name: '占い師1',
      avatar_path: null,
      self_pr: null,
      training_period: null,
      is_accepting: false,
      average_rating: null,
      review_count: 0,
      session_count: 0,
      tags: [],
    };
    mockSupabase.rpc.mockResolvedValue({ data: [teller], error: null } as never);

    const result = await listFavoriteTellers();

    expect(mockSupabase.rpc).toHaveBeenCalledWith('list_favorite_tellers');
    expect(result).toEqual({ data: [teller], error: null });
  });

  it('呼び出しに失敗したらerrorをそのまま返す', async () => {
    const error = { message: 'network error' };
    mockSupabase.rpc.mockResolvedValue({ data: null, error } as never);

    const result = await listFavoriteTellers();

    expect(result).toEqual({ data: null, error });
  });
});
