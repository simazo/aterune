import { supabase } from '@/lib/supabase';
import { createReview, getSessionReview, listTellerReviews } from './reviews';

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

describe('getSessionReview', () => {
  // from('reviews').select().eq().maybeSingle() の呼び出しを記録するモック
  function mockSessionReviewQuery(result: { data: unknown; error: unknown }) {
    const query = {
      select: jest.fn(),
      eq: jest.fn(),
      maybeSingle: jest.fn().mockResolvedValue(result),
    };
    query.select.mockReturnValue(query);
    query.eq.mockReturnValue(query);
    mockSupabase.from.mockReturnValue(query as never);
    return query;
  }

  it('セッションのレビューを1件取得する', async () => {
    const query = mockSessionReviewQuery({ data: REVIEW, error: null });

    const result = await getSessionReview('session-1');

    expect(mockSupabase.from).toHaveBeenCalledWith('reviews');
    expect(query.select).toHaveBeenCalledWith('id, rating, comment, created_at');
    expect(query.eq).toHaveBeenCalledWith('session_id', 'session-1');
    expect(result).toEqual({ data: REVIEW, error: null });
  });

  it('まだレビューが無ければdataをnullで返す', async () => {
    mockSessionReviewQuery({ data: null, error: null });

    const result = await getSessionReview('session-1');

    expect(result).toEqual({ data: null, error: null });
  });

  it('呼び出しに失敗したらerrorをそのまま返す', async () => {
    const error = { message: 'network error' };
    mockSessionReviewQuery({ data: null, error });

    const result = await getSessionReview('session-1');

    expect(result).toEqual({ data: null, error });
  });
});

describe('createReview', () => {
  // from('reviews').insert() の呼び出しを記録するモック
  function mockInsert(result: { error: unknown }) {
    const query = { insert: jest.fn().mockResolvedValue(result) };
    mockSupabase.from.mockReturnValue(query as never);
    return query;
  }

  const params = {
    sessionId: 'session-1',
    reviewerId: 'consultant-1',
    revieweeId: 'teller-1',
    rating: 4,
    comment: 'とても丁寧でした',
  };

  it('自分（相談者）名義で、セッションの占い師へのレビューを登録する', async () => {
    const query = mockInsert({ error: null });

    const result = await createReview(params);

    expect(mockSupabase.from).toHaveBeenCalledWith('reviews');
    expect(query.insert).toHaveBeenCalledWith({
      session_id: 'session-1',
      reviewer_id: 'consultant-1',
      reviewee_id: 'teller-1',
      rating: 4,
      comment: 'とても丁寧でした',
    });
    expect(result).toEqual({ error: null });
  });

  it('コメントが空ならnullで登録する', async () => {
    const query = mockInsert({ error: null });

    await createReview({ ...params, comment: '' });

    expect(query.insert).toHaveBeenCalledWith(expect.objectContaining({ comment: null }));
  });

  it('登録に失敗したらerrorをそのまま返す', async () => {
    const error = { code: '23505', message: 'duplicate key value' };
    mockInsert({ error });

    const result = await createReview(params);

    expect(result).toEqual({ error });
  });
});
