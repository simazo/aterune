import { supabase } from '@/lib/supabase';
import { getTeller, searchTellers } from './tellers';

jest.mock('@/lib/supabase', () => ({
  supabase: { rpc: jest.fn() },
}));

const mockSupabase = jest.mocked(supabase);

const TELLER = {
  teller_id: 'teller-1',
  display_name: '占い師1',
  avatar_url: null,
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
