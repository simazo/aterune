import { supabase } from '@/lib/supabase';
import { listTellerReviews } from './reviews';

jest.mock('@/lib/supabase', () => ({
  supabase: { from: jest.fn() },
}));

const mockSupabase = jest.mocked(supabase);

const REVIEW = {
  id: 'review-1',
  rating: 5,
  comment: 'とても丁寧でした',
  created_at: '2026-10-12T03:00:00+00:00',
};

// from('reviews').select().eq().order().order().limit() の呼び出しを記録するモック
function mockReviewsQuery(result: { data: unknown; error: unknown }) {
  const query = {
    select: jest.fn(),
    eq: jest.fn(),
    order: jest.fn(),
    limit: jest.fn().mockResolvedValue(result),
  };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.order.mockReturnValue(query);
  mockSupabase.from.mockReturnValue(query as never);
  return query;
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('listTellerReviews', () => {
  it('指定した占い師のレビューを、新しい順に指定した件数だけ取得する', async () => {
    const query = mockReviewsQuery({ data: [REVIEW], error: null });

    const result = await listTellerReviews('teller-1', 5);

    expect(mockSupabase.from).toHaveBeenCalledWith('reviews');
    expect(query.eq).toHaveBeenCalledWith('reviewee_id', 'teller-1');
    expect(query.order).toHaveBeenNthCalledWith(1, 'created_at', { ascending: false });
    expect(query.order).toHaveBeenNthCalledWith(2, 'id');
    expect(query.limit).toHaveBeenCalledWith(5);
    expect(result).toEqual({ data: [REVIEW], error: null });
  });

  it('レビューした相談者が分からないよう、reviewer_idは取得しない', async () => {
    const query = mockReviewsQuery({ data: [], error: null });

    await listTellerReviews('teller-1', 5);

    expect(query.select).toHaveBeenCalledWith('id, rating, comment, created_at');
  });

  it('呼び出しに失敗したらerrorをそのまま返す', async () => {
    const error = { message: 'network error' };
    mockReviewsQuery({ data: null, error });

    const result = await listTellerReviews('teller-1', 5);

    expect(result).toEqual({ data: null, error });
  });
});
