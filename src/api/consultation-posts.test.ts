import { supabase } from '@/lib/supabase';
import {
  applyToConsultationPost,
  closeConsultationPost,
  createConsultationPost,
  getConsultationPost,
  listConsultationPosts,
  listMyConsultationPosts,
} from './consultation-posts';

jest.mock('@/lib/supabase', () => ({
  supabase: { rpc: jest.fn(), from: jest.fn() },
}));

const mockSupabase = jest.mocked(supabase);

const POST = {
  id: 'post-1',
  concern_tag_id: 'tag-1',
  concern_tag_name: '恋愛・片思い',
  concern: '悩みの内容',
  status: 'open',
  created_at: '2026-10-23T03:00:00+00:00',
  is_mine: false,
  has_applied: false,
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('listConsultationPosts', () => {
  it('list_consultation_postsを引数なしで呼び、結果を返す', async () => {
    mockSupabase.rpc.mockResolvedValue({ data: [POST], error: null } as never);

    const result = await listConsultationPosts();

    expect(mockSupabase.rpc).toHaveBeenCalledWith('list_consultation_posts');
    expect(result).toEqual({ data: [POST], error: null });
  });
});

describe('getConsultationPost', () => {
  // get_consultation_post は 0 行か 1 行を返すので、maybeSingle で 1 件（または null）にする
  const mockMaybeSingle = jest.fn();

  beforeEach(() => {
    mockSupabase.rpc.mockReturnValue({ maybeSingle: mockMaybeSingle } as never);
  });

  it('投稿IDをget_consultation_postに渡し、1件を返す', async () => {
    mockMaybeSingle.mockResolvedValue({ data: POST, error: null });

    const result = await getConsultationPost('post-1');

    expect(mockSupabase.rpc).toHaveBeenCalledWith('get_consultation_post', { p_post_id: 'post-1' });
    expect(result).toEqual({ data: POST, error: null });
  });

  it('見られない・存在しない投稿ならdataはnull', async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });

    const result = await getConsultationPost('post-x');

    expect(result).toEqual({ data: null, error: null });
  });
});

describe('listMyConsultationPosts', () => {
  it('list_my_consultation_postsを引数なしで呼び、結果を返す', async () => {
    const { is_mine, has_applied, ...myPost } = POST;
    mockSupabase.rpc.mockResolvedValue({ data: [myPost], error: null } as never);

    const result = await listMyConsultationPosts();

    expect(mockSupabase.rpc).toHaveBeenCalledWith('list_my_consultation_posts');
    expect(result).toEqual({ data: [myPost], error: null });
  });
});

describe('createConsultationPost', () => {
  function mockInsert(result: { error: unknown }) {
    const query = { insert: jest.fn().mockResolvedValue(result), select: jest.fn() };
    mockSupabase.from.mockReturnValue(query as never);
    return query;
  }

  it('自分名義・悩みタグ・本文をconsultation_postsにinsertする', async () => {
    const query = mockInsert({ error: null });

    const result = await createConsultationPost({
      consultantId: 'user-1',
      concernTagId: 'tag-1',
      concern: '悩みの内容',
    });

    expect(mockSupabase.from).toHaveBeenCalledWith('consultation_posts');
    expect(query.insert).toHaveBeenCalledWith({
      consultant_id: 'user-1',
      concern_tag_id: 'tag-1',
      concern: '悩みの内容',
    });
    expect(result).toEqual({ error: null });
  });

  it('作った行をselectで読み返さない（SELECT権限が無く、保存できてもエラーになるため）', async () => {
    const query = mockInsert({ error: null });

    await createConsultationPost({ consultantId: 'user-1', concernTagId: 'tag-1', concern: 'x' });

    expect(query.select).not.toHaveBeenCalled();
  });

  it('insertに失敗したらerrorをそのまま返す', async () => {
    const error = { message: 'the tag is not a concern tag' };
    mockInsert({ error });

    const result = await createConsultationPost({ consultantId: 'user-1', concernTagId: 'tag-2', concern: 'x' });

    expect(result).toEqual({ error });
  });
});

describe('closeConsultationPost', () => {
  it('投稿IDをclose_consultation_postに渡す', async () => {
    mockSupabase.rpc.mockResolvedValue({ data: null, error: null } as never);

    const result = await closeConsultationPost('post-1');

    expect(mockSupabase.rpc).toHaveBeenCalledWith('close_consultation_post', { p_post_id: 'post-1' });
    expect(result).toEqual({ error: null });
  });
});

describe('applyToConsultationPost', () => {
  it('投稿IDとひとことをapply_to_consultation_postに渡し、作ったセッションのIDを返す', async () => {
    mockSupabase.rpc.mockResolvedValue({ data: 'session-1', error: null } as never);

    const result = await applyToConsultationPost({ postId: 'post-1', message: 'よろしくお願いします' });

    expect(mockSupabase.rpc).toHaveBeenCalledWith('apply_to_consultation_post', {
      p_post_id: 'post-1',
      p_applicant_message: 'よろしくお願いします',
    });
    expect(result).toEqual({ data: 'session-1', error: null });
  });

  it('ひとことが空ならnullで送る', async () => {
    mockSupabase.rpc.mockResolvedValue({ data: 'session-1', error: null } as never);

    await applyToConsultationPost({ postId: 'post-1', message: '' });

    expect(mockSupabase.rpc).toHaveBeenCalledWith('apply_to_consultation_post', {
      p_post_id: 'post-1',
      p_applicant_message: null,
    });
  });

  it('応募に失敗したらerrorをそのまま返す', async () => {
    const error = { message: 'cannot apply to a closed post' };
    mockSupabase.rpc.mockResolvedValue({ data: null, error } as never);

    const result = await applyToConsultationPost({ postId: 'post-1', message: '' });

    expect(result).toEqual({ data: null, error });
  });
});
