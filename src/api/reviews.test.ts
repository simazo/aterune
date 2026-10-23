import { supabase } from '@/lib/supabase';
import { createReview, getSessionReview, listTellerReviews } from './reviews';

jest.mock('@/lib/supabase', () => ({
  supabase: { rpc: jest.fn(), from: jest.fn() },
}));

const mockSupabase = jest.mocked(supabase);

const REVIEW = {
  id: 'review-1',
  rating: 5,
  comment: 'とても丁寧でした',
  created_at: '2026-10-12T03:00:00+00:00',
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('listTellerReviews', () => {
  it('公開用の RPC で、指定した占い師のレビューを指定した件数だけ取得する', async () => {
    mockSupabase.rpc.mockResolvedValue({ data: [REVIEW], error: null } as never);

    const result = await listTellerReviews('teller-1', 5);

    // reviews は当事者しか直接読めないため、テーブルを直接読まない
    expect(mockSupabase.from).not.toHaveBeenCalled();
    expect(mockSupabase.rpc).toHaveBeenCalledWith('list_teller_reviews', {
      p_teller_id: 'teller-1',
      p_limit: 5,
    });
    expect(result).toEqual({ data: [REVIEW], error: null });
  });

  it('呼び出しに失敗したらerrorをそのまま返す', async () => {
    const error = { message: 'network error' };
    mockSupabase.rpc.mockResolvedValue({ data: null, error } as never);

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
