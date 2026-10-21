import { logger } from '@/lib/logger';
import {
  getCurrentPlatform,
  getPushTokenIfPermittedAsync,
  registerForPushNotificationsAsync,
} from '@/lib/push-notifications';
import { supabase } from '@/lib/supabase';
import { deletePushTokenForCurrentDevice, savePushTokenForCurrentUser } from './push-tokens';

jest.mock('@/lib/push-notifications', () => ({
  registerForPushNotificationsAsync: jest.fn(),
  getPushTokenIfPermittedAsync: jest.fn(),
  getCurrentPlatform: jest.fn(),
}));

jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: jest.fn(),
    rpc: jest.fn(),
  },
}));

jest.mock('@/lib/logger', () => ({
  logger: { debug: jest.fn(), warn: jest.fn() },
}));

const TOKEN = 'ExponentPushToken[test]';
const mockRegisterForPushNotificationsAsync = jest.mocked(registerForPushNotificationsAsync);
const mockGetPushTokenIfPermittedAsync = jest.mocked(getPushTokenIfPermittedAsync);
const mockGetCurrentPlatform = jest.mocked(getCurrentPlatform);
const mockSupabase = jest.mocked(supabase);
const mockLogger = jest.mocked(logger);

beforeEach(() => {
  jest.clearAllMocks();
  mockRegisterForPushNotificationsAsync.mockResolvedValue(TOKEN);
  mockGetPushTokenIfPermittedAsync.mockResolvedValue(TOKEN);
  mockGetCurrentPlatform.mockReturnValue('ios');
});

describe('savePushTokenForCurrentUser', () => {
  it('tokenとplatformを渡してregister_push_tokenを呼ぶ', async () => {
    mockSupabase.rpc.mockResolvedValue({ error: null } as never);

    await savePushTokenForCurrentUser();

    expect(mockSupabase.rpc).toHaveBeenCalledWith('register_push_token', {
      p_token: TOKEN,
      p_platform: 'ios',
    });
  });

  it('tokenが取れなければ保存しない', async () => {
    mockRegisterForPushNotificationsAsync.mockResolvedValue(null);

    await savePushTokenForCurrentUser();

    expect(mockSupabase.rpc).not.toHaveBeenCalled();
  });

  it('register_push_tokenが失敗しても例外を投げずに終わり、warnでログを出す', async () => {
    mockSupabase.rpc.mockResolvedValue({ error: { message: 'rpc failed' } } as never);

    await expect(savePushTokenForCurrentUser()).resolves.toBeUndefined();
    expect(mockSupabase.rpc).toHaveBeenCalled();
    expect(mockLogger.warn).toHaveBeenCalledWith('push_tokens登録エラー:', 'rpc failed');
  });

  it('tokenの取得で例外が出ても例外を投げずに終わり、warnでログを出す', async () => {
    mockRegisterForPushNotificationsAsync.mockRejectedValue(new Error('offline'));

    await expect(savePushTokenForCurrentUser()).resolves.toBeUndefined();
    expect(mockSupabase.rpc).not.toHaveBeenCalled();
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

  it('通知の許可を求める関数は呼ばない', async () => {
    const eq = jest.fn().mockResolvedValue({ error: null });
    const del = jest.fn().mockReturnValue({ eq });
    mockSupabase.from.mockReturnValue({ delete: del } as never);

    await deletePushTokenForCurrentDevice();

    expect(mockRegisterForPushNotificationsAsync).not.toHaveBeenCalled();
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
    mockGetPushTokenIfPermittedAsync.mockResolvedValue(null);

    await deletePushTokenForCurrentDevice();

    expect(mockSupabase.from).not.toHaveBeenCalled();
  });

  it('tokenの取得で例外が出ても例外を投げずに終わり、warnでログを出す', async () => {
    mockGetPushTokenIfPermittedAsync.mockRejectedValue(new Error('offline'));

    await expect(deletePushTokenForCurrentDevice()).resolves.toBeUndefined();
    expect(mockSupabase.from).not.toHaveBeenCalled();
    expect(mockLogger.warn).toHaveBeenCalledWith('push token削除中に例外:', 'offline');
  });
});
