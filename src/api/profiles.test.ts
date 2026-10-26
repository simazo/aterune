import { supabase } from '@/lib/supabase';
import { getMyProfile, updateMyProfile } from './profiles';

jest.mock('@/lib/supabase', () => ({
  supabase: { from: jest.fn() },
}));

const mockSupabase = jest.mocked(supabase);

// from('profiles').select().eq().single() の呼び出しを記録するモック
function mockSelectQuery(result: { data: unknown; error: unknown }) {
  const query = {
    select: jest.fn(),
    eq: jest.fn(),
    single: jest.fn().mockResolvedValue(result),
  };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  mockSupabase.from.mockReturnValueOnce(query as never);
  return query;
}

// from('profiles').update().eq() の呼び出しを記録するモック
function mockUpdateQuery(result: { error: unknown }) {
  const query = {
    update: jest.fn(),
    eq: jest.fn().mockResolvedValue(result),
  };
  query.update.mockReturnValue(query);
  mockSupabase.from.mockReturnValueOnce(query as never);
  return query;
}

beforeEach(() => {
  jest.resetAllMocks();
});

describe('getMyProfile', () => {
  it('自分のIDでプロフィールを1件取得する', async () => {
    const profile = { display_name: '相談者', bio: null, avatar_path: null, is_teller: false };
    const query = mockSelectQuery({ data: profile, error: null });

    const result = await getMyProfile('user-1');

    expect(mockSupabase.from).toHaveBeenCalledWith('profiles');
    expect(query.select).toHaveBeenCalledWith('display_name, bio, avatar_path, is_teller');
    expect(query.eq).toHaveBeenCalledWith('id', 'user-1');
    expect(result).toEqual({ data: profile, error: null });
  });

  it('呼び出しに失敗したらerrorをそのまま返す', async () => {
    const error = { message: 'network error' };
    mockSelectQuery({ data: null, error });

    const result = await getMyProfile('user-1');

    expect(result).toEqual({ data: null, error });
  });
});

describe('updateMyProfile', () => {
  it('自分のIDの行の表示名と自己紹介を更新する', async () => {
    const query = mockUpdateQuery({ error: null });

    const result = await updateMyProfile('user-1', { displayName: '新しい名前', bio: 'よろしく' });

    expect(mockSupabase.from).toHaveBeenCalledWith('profiles');
    expect(query.update).toHaveBeenCalledWith({ display_name: '新しい名前', bio: 'よろしく' });
    expect(query.eq).toHaveBeenCalledWith('id', 'user-1');
    expect(result).toEqual({ error: null });
  });

  it('自己紹介が空ならnull（未入力）で保存する', async () => {
    const query = mockUpdateQuery({ error: null });

    await updateMyProfile('user-1', { displayName: '名前', bio: '' });

    expect(query.update).toHaveBeenCalledWith({ display_name: '名前', bio: null });
  });

  it('更新に失敗したらerrorを返す', async () => {
    const error = { message: 'network error' };
    mockUpdateQuery({ error });

    const result = await updateMyProfile('user-1', { displayName: '名前', bio: '' });

    expect(result).toEqual({ error });
  });
});
