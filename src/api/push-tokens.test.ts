import { logger } from '@/lib/logger';
import { supabase } from '@/lib/supabase';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { deletePushTokenForCurrentDevice, savePushTokenForCurrentUser } from './push-tokens';

jest.mock('expo-notifications', () => ({
  AndroidImportance: { DEFAULT: 3 },
  setNotificationChannelAsync: jest.fn(),
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  getExpoPushTokenAsync: jest.fn(),
}));

jest.mock('expo-device', () => ({ __esModule: true, isDevice: true }));

jest.mock('expo-constants', () => ({
  expoConfig: { extra: { eas: { projectId: 'test-project-id' } } },
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
const mockNotifications = jest.mocked(Notifications);
const mockSupabase = jest.mocked(supabase);
const mockLogger = jest.mocked(logger);

afterEach(() => {
  // replacePropertyで差し替えたPlatform.OSを元に戻す
  jest.restoreAllMocks();
});

beforeEach(() => {
  jest.clearAllMocks();
  mockNotifications.getPermissionsAsync.mockResolvedValue({ status: 'granted' } as never);
  mockNotifications.getExpoPushTokenAsync.mockResolvedValue({ data: TOKEN } as never);
});

describe('savePushTokenForCurrentUser', () => {
  it('ログイン中のユーザーIDとtokenをpush_tokensにupsertする', async () => {
    const upsert = jest.fn().mockResolvedValue({ error: null });
    mockSupabase.from.mockReturnValue({ upsert } as never);
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'user-1' } } } as never);

    await savePushTokenForCurrentUser();

    expect(mockSupabase.from).toHaveBeenCalledWith('push_tokens');
    expect(upsert).toHaveBeenCalledWith(
      { user_id: 'user-1', expo_push_token: TOKEN, platform: Platform.OS },
      { onConflict: 'user_id,expo_push_token', ignoreDuplicates: true }
    );
  });

  it('tokenが取れなければ保存しない', async () => {
    mockNotifications.getPermissionsAsync.mockResolvedValue({ status: 'denied' } as never);
    mockNotifications.requestPermissionsAsync.mockResolvedValue({ status: 'denied' } as never);

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
    jest.replaceProperty(Platform, 'OS', 'web');

    await deletePushTokenForCurrentDevice();

    expect(mockSupabase.from).not.toHaveBeenCalled();
  });
});
