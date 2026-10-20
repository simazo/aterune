import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import {
  getCurrentPlatform,
  getPushTokenIfPermittedAsync,
  registerForPushNotificationsAsync,
} from './push-notifications';

jest.mock('expo-notifications', () => ({
  AndroidImportance: { DEFAULT: 3 },
  setNotificationChannelAsync: jest.fn(),
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  getExpoPushTokenAsync: jest.fn(),
}));

// __esModule を付けないと import * 側でコピーされ、replaceProperty の差し替えが push-notifications.ts に届かない
jest.mock('expo-device', () => ({ __esModule: true, isDevice: true }));

jest.mock('expo-constants', () => ({
  expoConfig: { extra: { eas: { projectId: 'test-project-id' } } },
}));

const TOKEN = 'ExponentPushToken[test]';
const mockNotifications = jest.mocked(Notifications);

afterEach(() => {
  // replacePropertyで差し替えたPlatform.OSやDevice.isDeviceを元に戻す
  jest.restoreAllMocks();
});

beforeEach(() => {
  jest.clearAllMocks();
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

describe('getPushTokenIfPermittedAsync', () => {
  it('通知が許可されていればExpo Push Tokenを返す', async () => {
    await expect(getPushTokenIfPermittedAsync()).resolves.toBe(TOKEN);
    expect(mockNotifications.getExpoPushTokenAsync).toHaveBeenCalledWith({
      projectId: 'test-project-id',
    });
  });

  it('未許可なら許可を求めずにnullを返す', async () => {
    mockNotifications.getPermissionsAsync.mockResolvedValue({ status: 'denied' } as never);

    await expect(getPushTokenIfPermittedAsync()).resolves.toBeNull();
    expect(mockNotifications.requestPermissionsAsync).not.toHaveBeenCalled();
    expect(mockNotifications.getExpoPushTokenAsync).not.toHaveBeenCalled();
  });

  it('Web版では許可を確認せずnullを返す', async () => {
    jest.replaceProperty(Platform, 'OS', 'web');

    await expect(getPushTokenIfPermittedAsync()).resolves.toBeNull();
    expect(mockNotifications.getPermissionsAsync).not.toHaveBeenCalled();
  });

  it('実機でなければ許可を確認せずnullを返す', async () => {
    jest.replaceProperty(Device, 'isDevice', false);

    await expect(getPushTokenIfPermittedAsync()).resolves.toBeNull();
    expect(mockNotifications.getPermissionsAsync).not.toHaveBeenCalled();
  });
});

describe('getCurrentPlatform', () => {
  it.each(['ios', 'android', 'web'] as const)('Platform.OSが%sなら%sを返す', (os) => {
    jest.replaceProperty(Platform, 'OS', os);

    expect(getCurrentPlatform()).toBe(os);
  });
});
