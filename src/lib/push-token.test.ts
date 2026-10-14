import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import {
  deletePushTokenForCurrentDevice,
  getCurrentPlatform,
  registerForPushNotificationsAsync,
  savePushTokenForCurrentUser,
} from './push-token';
import { supabase } from './supabase';

jest.mock('expo-notifications', () => ({
  AndroidImportance: { DEFAULT: 3 },
  setNotificationChannelAsync: jest.fn(),
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  getExpoPushTokenAsync: jest.fn(),
}));

// __esModule を付けないと import * 側でコピーされ、replaceProperty の差し替えが push-token.ts に届かない
jest.mock('expo-device', () => ({ __esModule: true, isDevice: true }));

jest.mock('expo-constants', () => ({
  expoConfig: { extra: { eas: { projectId: 'test-project-id' } } },
}));

jest.mock('./supabase', () => ({
  supabase: {
    auth: { getUser: jest.fn() },
    from: jest.fn(),
  },
}));

const TOKEN = 'ExponentPushToken[test]';
const mockNotifications = jest.mocked(Notifications);
const mockSupabase = jest.mocked(supabase);

afterEach(() => {
  // replacePropertyで差し替えたPlatform.OSやconsole.logのspyを元に戻す
  jest.restoreAllMocks();
});

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, 'log').mockImplementation(() => {});
  mockNotifications.getPermissionsAsync.mockResolvedValue({ status: 'granted' } as never);
  mockNotifications.getExpoPushTokenAsync.mockResolvedValue({ data: TOKEN } as never);
});

describe('registerForPushNotificationsAsync', () => {
  it('通知が許可されていればExpo Push Tokenを返す', async () => {
    await expect(registerForPushNotificationsAsync()).resolves.toBe(TOKEN);
    expect(mockNotifications.getExpoPushTokenAsync).toHaveBeenCalledWith({
      projectId: 'test-project-id',
    });
  });

  it('未許可なら許可を求め、拒否されたらnullを返す', async () => {
    mockNotifications.getPermissionsAsync.mockResolvedValue({ status: 'undetermined' } as never);
    mockNotifications.requestPermissionsAsync.mockResolvedValue({ status: 'denied' } as never);

    await expect(registerForPushNotificationsAsync()).resolves.toBeNull();
    expect(mockNotifications.requestPermissionsAsync).toHaveBeenCalled();
    expect(mockNotifications.getExpoPushTokenAsync).not.toHaveBeenCalled();
  });

  it('Web版では何もせずnullを返す', async () => {
    jest.replaceProperty(Platform, 'OS', 'web');

    await expect(registerForPushNotificationsAsync()).resolves.toBeNull();
    expect(mockNotifications.getPermissionsAsync).not.toHaveBeenCalled();
  });

  it('Androidでは通知チャンネルを作成してからtokenを返す', async () => {
    jest.replaceProperty(Platform, 'OS', 'android');

    await expect(registerForPushNotificationsAsync()).resolves.toBe(TOKEN);
    expect(mockNotifications.setNotificationChannelAsync).toHaveBeenCalledWith('default', {
      name: 'default',
      importance: mockNotifications.AndroidImportance.DEFAULT,
    });
  });

  it('実機でなければ許可を確認せずnullを返す', async () => {
    jest.replaceProperty(Device, 'isDevice', false);

    await expect(registerForPushNotificationsAsync()).resolves.toBeNull();
    expect(mockNotifications.getPermissionsAsync).not.toHaveBeenCalled();
  });
});

describe('getCurrentPlatform', () => {
  it.each(['ios', 'android', 'web'] as const)('Platform.OSが%sなら%sを返す', (os) => {
    jest.replaceProperty(Platform, 'OS', os);

    expect(getCurrentPlatform()).toBe(os);
  });
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

  it('upsertが失敗しても例外を投げずに終わる', async () => {
    const upsert = jest.fn().mockResolvedValue({ error: { message: 'upsert failed' } });
    mockSupabase.from.mockReturnValue({ upsert } as never);
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'user-1' } } } as never);

    await expect(savePushTokenForCurrentUser()).resolves.toBeUndefined();
    expect(upsert).toHaveBeenCalled();
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

  it('deleteが失敗しても例外を投げずに終わる', async () => {
    const eq = jest.fn().mockResolvedValue({ error: { message: 'delete failed' } });
    const del = jest.fn().mockReturnValue({ eq });
    mockSupabase.from.mockReturnValue({ delete: del } as never);

    await expect(deletePushTokenForCurrentDevice()).resolves.toBeUndefined();
    expect(eq).toHaveBeenCalledWith('expo_push_token', TOKEN);
  });

  it('tokenが取れなければ何もしない', async () => {
    jest.replaceProperty(Platform, 'OS', 'web');

    await deletePushTokenForCurrentDevice();

    expect(mockSupabase.from).not.toHaveBeenCalled();
  });
});
