import { supabase } from '@/lib/supabase';
import {
  countUnreadNotifications,
  listMyNotifications,
  markAllNotificationsRead,
  markSessionNotificationsRead,
} from './notifications';

jest.mock('@/lib/supabase', () => ({
  supabase: { rpc: jest.fn(), from: jest.fn() },
}));

const mockSupabase = jest.mocked(supabase);

const NOTIFICATION = {
  session_id: 'session-1',
  type: 'message_received',
  created_at: '2026-10-27T03:00:00+00:00',
  unread_count: 2,
  partner_display_name: 'ボブ',
  partner_avatar_path: null,
};

beforeEach(() => {
  jest.clearAllMocks();
});

// from('notifications').update().eq().eq() の呼び出しを記録するモック
function mockUpdate(result: { error: unknown }) {
  const query = {
    update: jest.fn(),
    eq: jest.fn(),
  };
  query.update.mockReturnValue(query);
  // 2つ目の eq で結果を返す
  query.eq.mockReturnValueOnce(query).mockResolvedValueOnce(result);
  mockSupabase.from.mockReturnValue(query as never);
  return query;
}

describe('listMyNotifications', () => {
  it('RPC で自分宛ての通知の一覧を取得する', async () => {
    mockSupabase.rpc.mockResolvedValue({ data: [NOTIFICATION], error: null } as never);

    const result = await listMyNotifications();

    expect(mockSupabase.rpc).toHaveBeenCalledWith('list_my_notifications');
    expect(result).toEqual({ data: [NOTIFICATION], error: null });
  });

  it('呼び出しに失敗したらerrorをそのまま返す', async () => {
    const error = { message: 'network error' };
    mockSupabase.rpc.mockResolvedValue({ data: null, error } as never);

    const result = await listMyNotifications();

    expect(result).toEqual({ data: null, error });
  });
});

describe('countUnreadNotifications', () => {
  it('RPC で未読の件数を取得する', async () => {
    mockSupabase.rpc.mockResolvedValue({ data: 3, error: null } as never);

    const result = await countUnreadNotifications();

    expect(mockSupabase.rpc).toHaveBeenCalledWith('count_unread_notifications');
    expect(result).toEqual({ data: 3, error: null });
  });

  it('呼び出しに失敗したらerrorをそのまま返す', async () => {
    const error = { message: 'network error' };
    mockSupabase.rpc.mockResolvedValue({ data: null, error } as never);

    const result = await countUnreadNotifications();

    expect(result).toEqual({ data: null, error });
  });
});

describe('markSessionNotificationsRead', () => {
  it('指定したセッションの未読の通知を既読にする', async () => {
    const query = mockUpdate({ error: null });

    const result = await markSessionNotificationsRead('session-1');

    expect(mockSupabase.from).toHaveBeenCalledWith('notifications');
    expect(query.update).toHaveBeenCalledWith({ is_read: true });
    expect(query.eq).toHaveBeenCalledWith('session_id', 'session-1');
    expect(query.eq).toHaveBeenCalledWith('is_read', false);
    expect(result).toEqual({ error: null });
  });

  it('呼び出しに失敗したらerrorをそのまま返す', async () => {
    const error = { message: 'network error' };
    mockUpdate({ error });

    const result = await markSessionNotificationsRead('session-1');

    expect(result).toEqual({ error });
  });
});

describe('markAllNotificationsRead', () => {
  it('自分宛ての未読の通知をすべて既読にする', async () => {
    const query = mockUpdate({ error: null });

    const result = await markAllNotificationsRead('user-1');

    expect(mockSupabase.from).toHaveBeenCalledWith('notifications');
    expect(query.update).toHaveBeenCalledWith({ is_read: true });
    expect(query.eq).toHaveBeenCalledWith('recipient_id', 'user-1');
    expect(query.eq).toHaveBeenCalledWith('is_read', false);
    expect(result).toEqual({ error: null });
  });

  it('呼び出しに失敗したらerrorをそのまま返す', async () => {
    const error = { message: 'network error' };
    mockUpdate({ error });

    const result = await markAllNotificationsRead('user-1');

    expect(result).toEqual({ error });
  });
});
