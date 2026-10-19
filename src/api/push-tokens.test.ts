import { logger } from '@/lib/logger';
import { getCurrentPlatform, registerForPushNotificationsAsync } from '@/lib/push-notifications';
import { supabase } from '@/lib/supabase';
import { deletePushTokenForCurrentDevice, savePushTokenForCurrentUser } from './push-tokens';

jest.mock('@/lib/push-notifications', () => ({
  registerForPushNotificationsAsync: jest.fn(),
  getCurrentPlatform: jest.fn(),
}));

jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: { getUser: jest.fn() },
    from: jest.fn(),
  },
}));

jest.mock('@/lib/logger', () => ({
  logger: { debug: jest.fn(), warn: jest.fn() },
}));

const TOKEN = 'ExponentPushToken[test]';
const mockRegisterForPushNotificationsAsync = jest.mocked(registerForPushNotificationsAsync);
const mockGetCurrentPlatform = jest.mocked(getCurrentPlatform);
const mockSupabase = jest.mocked(supabase);
const mockLogger = jest.mocked(logger);

beforeEach(() => {
  jest.clearAllMocks();
  mockRegisterForPushNotificationsAsync.mockResolvedValue(TOKEN);
  mockGetCurrentPlatform.mockReturnValue('ios');
});

describe('savePushTokenForCurrentUser', () => {
  it('ログイン中のユーザーIDとtokenをpush_tokensにupsertする', async () => {
    const upsert = jest.fn().mockResolvedValue({ error: null });
    mockSupabase.from.mockReturnValue({ upsert } as never);
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'user-1' } } } as never);

    await savePushTokenForCurrentUser();

    expect(mockSupabase.from).toHaveBeenCalledWith('push_tokens');
    expect(upsert).toHaveBeenCalledWith(
      { user_id: 'user-1', expo_push_token: TOKEN, platform: 'ios' },
      { onConflict: 'user_id,expo_push_token', ignoreDuplicates: true }
    );
  });

  it('tokenが取れなければ保存しない', async () => {
    mockRegisterForPushNotificationsAsync.mockResolvedValue(null);

    await savePushTokenForCurrentUser();

    expect(mockSupabase.from).not.toHaveBeenCalled();
  });

  it('ログイン中のユーザーがいなければ保存しない', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: null } } as never);

    await savePushTokenForCurrentUser();

    expect(mockSupabase.from).not.toHaveBeenCalled();
  });

  it('upsertが失敗しても例外を投げずに終わり、warnでログを出す', async () => {
    const upsert = jest.fn().mockResolvedValue({ error: { message: 'upsert failed' } });
    mockSupabase.from.mockReturnValue({ upsert } as never);
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'user-1' } } } as never);

    await expect(savePushTokenForCurrentUser()).resolves.toBeUndefined();
    expect(upsert).toHaveBeenCalled();
    expect(mockLogger.warn).toHaveBeenCalledWith('push_tokens登録エラー:', 'upsert failed');
  });

  it('tokenの取得で例外が出ても例外を投げずに終わり、warnでログを出す', async () => {
    mockRegisterForPushNotificationsAsync.mockRejectedValue(new Error('offline'));

    await expect(savePushTokenForCurrentUser()).resolves.toBeUndefined();
    expect(mockSupabase.from).not.toHaveBeenCalled();
    expect(mockLogger.warn).toHaveBeenCalledWith('push token登録中に例外:', 'offline');
  });
});

describe('deletePushTokenForCurrentDevice', () => {
  it('この端末のtokenの行をpush_tokensから削除する', async () => {
    const eq = jest.fn().mockResolvedValue({ error: null });
    const del = jest.fn().mockReturnValue({ eq });
    mockSupabase.from.mockReturnValue({ delete: del } as never);

    await deletePushTokenForCurrentDevice();

    expect(mockSupabase.from).toHaveBeenCalledWith('push_tokens');
    expect(eq).toHaveBeenCalledWith('expo_push_token', TOKEN);
  });

  it('deleteが失敗しても例外を投げずに終わり、warnでログを出す', async () => {
    const eq = jest.fn().mockResolvedValue({ error: { message: 'delete failed' } });
    const del = jest.fn().mockReturnValue({ eq });
    mockSupabase.from.mockReturnValue({ delete: del } as never);

    await expect(deletePushTokenForCurrentDevice()).resolves.toBeUndefined();
    expect(eq).toHaveBeenCalledWith('expo_push_token', TOKEN);
    expect(mockLogger.warn).toHaveBeenCalledWith('push_tokens削除エラー:', 'delete failed');
  });

  it('tokenが取れなければ何もしない', async () => {
    mockRegisterForPushNotificationsAsync.mockResolvedValue(null);

    await deletePushTokenForCurrentDevice();

    expect(mockSupabase.from).not.toHaveBeenCalled();
  });

  it('tokenの取得で例外が出ても例外を投げずに終わり、warnでログを出す', async () => {
    mockRegisterForPushNotificationsAsync.mockRejectedValue(new Error('offline'));

    await expect(deletePushTokenForCurrentDevice()).resolves.toBeUndefined();
    expect(mockSupabase.from).not.toHaveBeenCalled();
    expect(mockLogger.warn).toHaveBeenCalledWith('push token削除中に例外:', 'offline');
  });
});
