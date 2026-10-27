import { supabase } from '@/lib/supabase';
import { getMyTellerProfile, getTeller, saveTellerProfile, searchTellers } from './tellers';

jest.mock('@/lib/supabase', () => ({
  supabase: { rpc: jest.fn(), from: jest.fn() },
}));

const mockSupabase = jest.mocked(supabase);

const TELLER = {
  teller_id: 'teller-1',
  display_name: '占い師1',
  avatar_path: null,
  self_pr: '自己PR',
  training_period: '半年',
  is_accepting: true,
  average_rating: 4.5,
  review_count: 2,
  session_count: 3,
  tags: [{ slug: 'tarot', category: 'divination', name: 'タロット' }],
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('searchTellers', () => {
  it('選んだタグのslug・受付中のみ・並び順をsearch_tellersに渡し、結果を返す', async () => {
    mockSupabase.rpc.mockResolvedValue({ data: [TELLER], error: null } as never);

    const result = await searchTellers({
      tagSlugs: ['tarot', 'gentle'],
      isAcceptingOnly: true,
      sort: 'rating',
    });

    expect(mockSupabase.rpc).toHaveBeenCalledWith('search_tellers', {
      p_tag_slugs: ['tarot', 'gentle'],
      p_accepting_only: true,
      p_sort: 'rating',
    });
    expect(result).toEqual({ data: [TELLER], error: null });
  });

  it('タグを選ばず受付中のみもオフなら、空配列とfalseを渡す（全占い師が対象）', async () => {
    mockSupabase.rpc.mockResolvedValue({ data: [], error: null } as never);

    await searchTellers({ tagSlugs: [], isAcceptingOnly: false, sort: 'newest' });

    expect(mockSupabase.rpc).toHaveBeenCalledWith('search_tellers', {
      p_tag_slugs: [],
      p_accepting_only: false,
      p_sort: 'newest',
    });
  });

  it('呼び出しに失敗したらerrorをそのまま返す', async () => {
    const error = { message: 'network error' };
    mockSupabase.rpc.mockResolvedValue({ data: null, error } as never);

    const result = await searchTellers({ tagSlugs: ['tarot'], isAcceptingOnly: false, sort: 'newest' });

    expect(result).toEqual({ data: null, error });
  });
});

describe('getTeller', () => {
  const TELLER_DETAIL = {
    ...TELLER,
    requires_birthdate: true,
    favorite_count: 1,
    created_at: '2026-10-01T03:00:00+00:00',
  };

  // get_teller は 0 行か 1 行を返すので、maybeSingle で 1 件（または null）にする
  const mockMaybeSingle = jest.fn();

  beforeEach(() => {
    mockSupabase.rpc.mockReturnValue({ maybeSingle: mockMaybeSingle } as never);
  });

  it('占い師のIDをget_tellerに渡し、1件を返す', async () => {
    mockMaybeSingle.mockResolvedValue({ data: TELLER_DETAIL, error: null });

    const result = await getTeller('teller-1');

    expect(mockSupabase.rpc).toHaveBeenCalledWith('get_teller', { p_teller_id: 'teller-1' });
    expect(mockMaybeSingle).toHaveBeenCalled();
    expect(result).toEqual({ data: TELLER_DETAIL, error: null });
  });

  it('占い師が見つからなければ、dataをnullで返す', async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });

    const result = await getTeller('no-such-teller');

    expect(result).toEqual({ data: null, error: null });
  });

  it('呼び出しに失敗したらerrorをそのまま返す', async () => {
    const error = { message: 'network error' };
    mockMaybeSingle.mockResolvedValue({ data: null, error });

    const result = await getTeller('teller-1');

    expect(result).toEqual({ data: null, error });
  });
});

describe('getMyTellerProfile', () => {
  // from('teller_profiles').select().eq().maybeSingle() の呼び出しを記録するモック
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

  it('自分の占い師プロフィールを、付いているタグのIDと一緒に取得する', async () => {
    const query = mockSelectQuery({
      data: {
        self_pr: '自己PR',
        training_period: '半年',
        requires_birthdate: true,
        is_accepting: false,
        teller_tags: [{ tag_id: 'tag-1' }, { tag_id: 'tag-2' }],
      },
      error: null,
    });

    const result = await getMyTellerProfile('user-1');

    expect(mockSupabase.from).toHaveBeenCalledWith('teller_profiles');
    expect(query.select).toHaveBeenCalledWith(
      'self_pr, training_period, requires_birthdate, is_accepting, teller_tags(tag_id)'
    );
    expect(query.eq).toHaveBeenCalledWith('profile_id', 'user-1');
    expect(result).toEqual({
      data: {
        self_pr: '自己PR',
        training_period: '半年',
        requires_birthdate: true,
        is_accepting: false,
        tag_ids: ['tag-1', 'tag-2'],
      },
      error: null,
    });
  });

  it('タグが付いていなければtag_idsを空配列で返す', async () => {
    mockSelectQuery({
      data: {
        self_pr: null,
        training_period: null,
        requires_birthdate: false,
        is_accepting: true,
        teller_tags: [],
      },
      error: null,
    });

    const result = await getMyTellerProfile('user-1');

    expect(result.data?.tag_ids).toEqual([]);
  });

  it('占い師として未登録ならnullを返す', async () => {
    mockSelectQuery({ data: null, error: null });

    const result = await getMyTellerProfile('user-1');

    expect(result).toEqual({ data: null, error: null });
  });

  it('呼び出しに失敗したらerrorをそのまま返す', async () => {
    const error = { message: 'network error' };
    mockSelectQuery({ data: null, error });

    const result = await getMyTellerProfile('user-1');

    expect(result).toEqual({ data: null, error });
  });
});

describe('saveTellerProfile', () => {
  it('入力内容とタグのIDをsave_teller_profileに渡す', async () => {
    mockSupabase.rpc.mockResolvedValue({ data: null, error: null } as never);

    const result = await saveTellerProfile({
      selfPr: '自己PR',
      trainingPeriod: '半年',
      requiresBirthdate: true,
      isAccepting: false,
      tagIds: ['tag-1', 'tag-2'],
    });

    expect(mockSupabase.rpc).toHaveBeenCalledWith('save_teller_profile', {
      p_self_pr: '自己PR',
      p_training_period: '半年',
      p_requires_birthdate: true,
      p_is_accepting: false,
      p_tag_ids: ['tag-1', 'tag-2'],
    });
    expect(result).toEqual({ error: null });
  });

  it('自己PR・修行期間が空ならnull（未入力）で渡す', async () => {
    mockSupabase.rpc.mockResolvedValue({ data: null, error: null } as never);

    await saveTellerProfile({
      selfPr: '',
      trainingPeriod: '',
      requiresBirthdate: false,
      isAccepting: true,
      tagIds: ['tag-1'],
    });

    expect(mockSupabase.rpc).toHaveBeenCalledWith(
      'save_teller_profile',
      expect.objectContaining({ p_self_pr: null, p_training_period: null })
    );
  });

  it('呼び出しに失敗したらerrorを返す', async () => {
    const error = { message: 'network error' };
    mockSupabase.rpc.mockResolvedValue({ data: null, error } as never);

    const result = await saveTellerProfile({
      selfPr: '',
      trainingPeriod: '',
      requiresBirthdate: false,
      isAccepting: true,
      tagIds: ['tag-1'],
    });

    expect(result).toEqual({ error });
  });
});
