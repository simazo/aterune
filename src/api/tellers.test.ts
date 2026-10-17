import { supabase } from '@/lib/supabase';
import { searchTellers } from './tellers';

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
  it('選んだタグのslugをp_tag_slugsに渡してsearch_tellersを呼び、結果を返す', async () => {
    mockSupabase.rpc.mockResolvedValue({ data: [TELLER], error: null } as never);

    const result = await searchTellers(['tarot', 'gentle']);

    expect(mockSupabase.rpc).toHaveBeenCalledWith('search_tellers', { p_tag_slugs: ['tarot', 'gentle'] });
    expect(result).toEqual({ data: [TELLER], error: null });
  });

  it('タグを選んでいなければ空配列を渡す（全占い師が対象）', async () => {
    mockSupabase.rpc.mockResolvedValue({ data: [], error: null } as never);

    await searchTellers([]);

    expect(mockSupabase.rpc).toHaveBeenCalledWith('search_tellers', { p_tag_slugs: [] });
  });

  it('呼び出しに失敗したらerrorをそのまま返す', async () => {
    const error = { message: 'network error' };
    mockSupabase.rpc.mockResolvedValue({ data: null, error } as never);

    const result = await searchTellers(['tarot']);

    expect(result).toEqual({ data: null, error });
  });
});
