import { supabase } from '@/lib/supabase';
import {
  getMyBirthdate,
  getMyPrivateDetails,
  saveMyBirthdate,
  saveMyPrivateDetails,
} from './profile-private-details';

jest.mock('@/lib/supabase', () => ({
  supabase: { from: jest.fn() },
}));

const mockSupabase = jest.mocked(supabase);

// from('profile_private_details').select().eq().maybeSingle() の呼び出しを記録するモック
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

// from('profile_private_details').update().eq().select() の呼び出しを記録するモック
function mockUpdateQuery(result: { data: unknown; error: unknown }) {
  const query = {
    update: jest.fn(),
    eq: jest.fn(),
    select: jest.fn().mockResolvedValue(result),
  };
  query.update.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  mockSupabase.from.mockReturnValueOnce(query as never);
  return query;
}

// from('profile_private_details').insert() の呼び出しを記録するモック
function mockInsertQuery(result: { error: unknown }) {
  const query = { insert: jest.fn().mockResolvedValue(result) };
  mockSupabase.from.mockReturnValueOnce(query as never);
  return query;
}

beforeEach(() => {
  jest.resetAllMocks();
});

describe('getMyBirthdate', () => {
  it('自分の行から生年月日を取得する', async () => {
    const query = mockSelectQuery({ data: { birthdate: '1990-01-01' }, error: null });

    const result = await getMyBirthdate('user-1');

    expect(mockSupabase.from).toHaveBeenCalledWith('profile_private_details');
    expect(query.select).toHaveBeenCalledWith('birthdate');
    expect(query.eq).toHaveBeenCalledWith('profile_id', 'user-1');
    expect(result).toEqual({ data: '1990-01-01', error: null });
  });

  it('行が無ければnullを返す', async () => {
    mockSelectQuery({ data: null, error: null });

    const result = await getMyBirthdate('user-1');

    expect(result).toEqual({ data: null, error: null });
  });

  it('行はあっても生年月日が未入力ならnullを返す', async () => {
    mockSelectQuery({ data: { birthdate: null }, error: null });

    const result = await getMyBirthdate('user-1');

    expect(result).toEqual({ data: null, error: null });
  });

  it('呼び出しに失敗したらdataをnullにしてerrorを返す', async () => {
    const error = { message: 'network error' };
    mockSelectQuery({ data: null, error });

    const result = await getMyBirthdate('user-1');

    expect(result).toEqual({ data: null, error });
  });
});

describe('saveMyBirthdate', () => {
  it('自分の行があれば生年月日だけを更新し、insertはしない', async () => {
    const update = mockUpdateQuery({ data: [{ profile_id: 'user-1' }], error: null });

    const result = await saveMyBirthdate('user-1', '1990-01-01');

    expect(mockSupabase.from).toHaveBeenCalledTimes(1);
    expect(update.update).toHaveBeenCalledWith({ birthdate: '1990-01-01' });
    expect(update.eq).toHaveBeenCalledWith('profile_id', 'user-1');
    expect(result).toEqual({ error: null });
  });

  it('自分の行が無ければ、自分のIDで行を作って生年月日を保存する', async () => {
    mockUpdateQuery({ data: [], error: null });
    const insert = mockInsertQuery({ error: null });

    const result = await saveMyBirthdate('user-1', '1990-01-01');

    expect(mockSupabase.from).toHaveBeenNthCalledWith(2, 'profile_private_details');
    expect(insert.insert).toHaveBeenCalledWith({ profile_id: 'user-1', birthdate: '1990-01-01' });
    expect(result).toEqual({ error: null });
  });

  it('更新に失敗したらinsertせずにerrorを返す', async () => {
    const error = { message: 'network error' };
    mockUpdateQuery({ data: null, error });

    const result = await saveMyBirthdate('user-1', '1990-01-01');

    expect(mockSupabase.from).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ error });
  });

  it('行の作成に失敗したらerrorを返す', async () => {
    const error = { message: 'network error' };
    mockUpdateQuery({ data: [], error: null });
    mockInsertQuery({ error });

    const result = await saveMyBirthdate('user-1', '1990-01-01');

    expect(result).toEqual({ error });
  });
});

describe('getMyPrivateDetails', () => {
  it('自分の行から生年月日と性別を取得する', async () => {
    const query = mockSelectQuery({ data: { birthdate: '1990-01-01', gender: 'female' }, error: null });

    const result = await getMyPrivateDetails('user-1');

    expect(mockSupabase.from).toHaveBeenCalledWith('profile_private_details');
    expect(query.select).toHaveBeenCalledWith('birthdate, gender');
    expect(query.eq).toHaveBeenCalledWith('profile_id', 'user-1');
    expect(result).toEqual({ data: { birthdate: '1990-01-01', gender: 'female' }, error: null });
  });

  it('行が無ければnullを返す', async () => {
    mockSelectQuery({ data: null, error: null });

    const result = await getMyPrivateDetails('user-1');

    expect(result).toEqual({ data: null, error: null });
  });

  it('呼び出しに失敗したらerrorをそのまま返す', async () => {
    const error = { message: 'network error' };
    mockSelectQuery({ data: null, error });

    const result = await getMyPrivateDetails('user-1');

    expect(result).toEqual({ data: null, error });
  });
});

describe('saveMyPrivateDetails', () => {
  it('自分の行があれば生年月日と性別を更新し、insertはしない', async () => {
    const update = mockUpdateQuery({ data: [{ profile_id: 'user-1' }], error: null });

    const result = await saveMyPrivateDetails('user-1', { birthdate: '1990-01-01', gender: 'male' });

    expect(mockSupabase.from).toHaveBeenCalledTimes(1);
    expect(update.update).toHaveBeenCalledWith({ birthdate: '1990-01-01', gender: 'male' });
    expect(update.eq).toHaveBeenCalledWith('profile_id', 'user-1');
    expect(result).toEqual({ error: null });
  });

  it('未入力・回答しないはnullのまま保存する', async () => {
    const update = mockUpdateQuery({ data: [{ profile_id: 'user-1' }], error: null });

    await saveMyPrivateDetails('user-1', { birthdate: null, gender: null });

    expect(update.update).toHaveBeenCalledWith({ birthdate: null, gender: null });
  });

  it('自分の行が無ければ、自分のIDで行を作って保存する', async () => {
    mockUpdateQuery({ data: [], error: null });
    const insert = mockInsertQuery({ error: null });

    const result = await saveMyPrivateDetails('user-1', { birthdate: '1990-01-01', gender: 'other' });

    expect(mockSupabase.from).toHaveBeenNthCalledWith(2, 'profile_private_details');
    expect(insert.insert).toHaveBeenCalledWith({
      profile_id: 'user-1',
      birthdate: '1990-01-01',
      gender: 'other',
    });
    expect(result).toEqual({ error: null });
  });

  it('更新に失敗したらinsertせずにerrorを返す', async () => {
    const error = { message: 'network error' };
    mockUpdateQuery({ data: null, error });

    const result = await saveMyPrivateDetails('user-1', { birthdate: null, gender: null });

    expect(mockSupabase.from).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ error });
  });

  it('行の作成に失敗したらerrorを返す', async () => {
    const error = { message: 'network error' };
    mockUpdateQuery({ data: [], error: null });
    mockInsertQuery({ error });

    const result = await saveMyPrivateDetails('user-1', { birthdate: null, gender: null });

    expect(result).toEqual({ error });
  });
});
