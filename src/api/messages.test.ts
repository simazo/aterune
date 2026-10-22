import { supabase } from '@/lib/supabase';
import { listMessages, sendMessage } from './messages';

jest.mock('@/lib/supabase', () => ({
  supabase: { from: jest.fn() },
}));

const mockSupabase = jest.mocked(supabase);

// from('messages').select().eq().order() の呼び出しを記録するモック
function mockListQuery(result: { data: unknown; error: unknown }) {
  const query = {
    select: jest.fn(),
    eq: jest.fn(),
    order: jest.fn().mockResolvedValue(result),
  };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  mockSupabase.from.mockReturnValueOnce(query as never);
  return query;
}

// from('messages').insert() の呼び出しを記録するモック
function mockInsertQuery(result: { error: unknown }) {
  const query = { insert: jest.fn().mockResolvedValue(result) };
  mockSupabase.from.mockReturnValueOnce(query as never);
  return query;
}

beforeEach(() => {
  jest.resetAllMocks();
});

describe('listMessages', () => {
  it('セッションのメッセージを古い順に取得する', async () => {
    const messages = [
      {
        id: 'm1',
        sender_id: 'user-1',
        content: 'こんにちは',
        created_at: '2026-10-22T01:00:00.000Z',
      },
    ];
    const query = mockListQuery({ data: messages, error: null });

    const result = await listMessages('session-1');

    expect(mockSupabase.from).toHaveBeenCalledWith('messages');
    expect(query.select).toHaveBeenCalledWith('id, sender_id, content, created_at');
    expect(query.eq).toHaveBeenCalledWith('session_id', 'session-1');
    expect(query.order).toHaveBeenCalledWith('created_at', { ascending: true });
    expect(result).toEqual({ data: messages, error: null });
  });

  it('呼び出しに失敗したらerrorをそのまま返す', async () => {
    const error = { message: 'network error' };
    mockListQuery({ data: null, error });

    const result = await listMessages('session-1');

    expect(result).toEqual({ data: null, error });
  });
});

describe('sendMessage', () => {
  it('自分を送信者にして、セッションにメッセージを登録する', async () => {
    const query = mockInsertQuery({ error: null });

    const result = await sendMessage({
      sessionId: 'session-1',
      senderId: 'user-1',
      content: 'よろしくお願いします',
    });

    expect(mockSupabase.from).toHaveBeenCalledWith('messages');
    expect(query.insert).toHaveBeenCalledWith({
      session_id: 'session-1',
      sender_id: 'user-1',
      content: 'よろしくお願いします',
    });
    expect(result).toEqual({ error: null });
  });

  it('送れなかったら（進行中でない・文字数の超過など）errorをそのまま返す', async () => {
    const error = { message: 'new row violates row-level security policy for table "messages"' };
    mockInsertQuery({ error });

    const result = await sendMessage({ sessionId: 'session-1', senderId: 'user-1', content: 'x' });

    expect(result).toEqual({ error });
  });
});
