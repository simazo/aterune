import { renderHook, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { useNotificationResponse } from './use-notification-response';

jest.mock('expo-notifications', () => ({
  DEFAULT_ACTION_IDENTIFIER: 'expo.modules.notifications.actions.DEFAULT',
  getLastNotificationResponseAsync: jest.fn(),
  clearLastNotificationResponseAsync: jest.fn(),
  addNotificationResponseReceivedListener: jest.fn(),
}));

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));

const mockNotifications = jest.mocked(Notifications);
const mockPush = jest.mocked(router.push);

const USER_ID = 'user-1';
const OTHER_USER_ID = 'user-2';

// 通知をタップしたときのレスポンス（使うところだけ）
function responseWith(
  data: Record<string, unknown>,
  {
    identifier = 'notification-1',
    actionIdentifier = Notifications.DEFAULT_ACTION_IDENTIFIER,
  }: { identifier?: string; actionIdentifier?: string } = {}
) {
  return {
    actionIdentifier,
    notification: { request: { identifier, content: { data } } },
  } as unknown as Notifications.NotificationResponse;
}

// addNotificationResponseReceivedListener に渡されたリスナーを呼んで、タップを再現する
function tap(response: Notifications.NotificationResponse) {
  const calls = mockNotifications.addNotificationResponseReceivedListener.mock.calls;
  const listener = calls[calls.length - 1][0];
  listener(response);
}

beforeEach(() => {
  jest.clearAllMocks();
  mockNotifications.getLastNotificationResponseAsync.mockResolvedValue(null);
  mockNotifications.clearLastNotificationResponseAsync.mockResolvedValue(undefined);
  mockNotifications.addNotificationResponseReceivedListener.mockReturnValue({ remove: jest.fn() });
});

afterEach(() => {
  // replacePropertyで差し替えたPlatform.OSを元に戻す
  jest.restoreAllMocks();
});

describe('useNotificationResponse', () => {
  it('ログイン中に、まだ処理していない自分宛ての通知のタップがあるなら、そのセッション詳細を開く', async () => {
    mockNotifications.getLastNotificationResponseAsync.mockResolvedValue(
      responseWith({ session_id: 'session-1', recipient_id: USER_ID })
    );

    await renderHook(() => useNotificationResponse(USER_ID));

    await waitFor(() =>
      expect(mockPush).toHaveBeenCalledWith({ pathname: '/sessions/[id]', params: { id: 'session-1' } })
    );
  });

  it('通知のタップを処理するなら、同じタップで再び開かないよう、開く前に記録を消す', async () => {
    const calls: string[] = [];
    mockNotifications.clearLastNotificationResponseAsync.mockImplementation(async () => {
      calls.push('clear');
    });
    mockPush.mockImplementation(() => {
      calls.push('push');
    });
    mockNotifications.getLastNotificationResponseAsync.mockResolvedValue(
      responseWith({ session_id: 'session-1', recipient_id: USER_ID })
    );

    await renderHook(() => useNotificationResponse(USER_ID));

    await waitFor(() => expect(calls).toEqual(['clear', 'push']));
  });

  it('ほかのユーザー宛ての通知なら、開かずに記録を消す', async () => {
    mockNotifications.getLastNotificationResponseAsync.mockResolvedValue(
      responseWith({ session_id: 'session-1', recipient_id: OTHER_USER_ID })
    );

    await renderHook(() => useNotificationResponse(USER_ID));

    await waitFor(() => expect(mockNotifications.clearLastNotificationResponseAsync).toHaveBeenCalled());
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('未ログインなら、通知のタップを読まず、記録も消さない', async () => {
    mockNotifications.getLastNotificationResponseAsync.mockResolvedValue(
      responseWith({ session_id: 'session-1', recipient_id: USER_ID })
    );

    await renderHook(() => useNotificationResponse(undefined));

    expect(mockNotifications.getLastNotificationResponseAsync).not.toHaveBeenCalled();
    expect(mockNotifications.addNotificationResponseReceivedListener).not.toHaveBeenCalled();
    expect(mockNotifications.clearLastNotificationResponseAsync).not.toHaveBeenCalled();
  });

  it('未ログインの間にタップされた自分宛ての通知があるなら、ログインしたときにそのセッション詳細を開く', async () => {
    mockNotifications.getLastNotificationResponseAsync.mockResolvedValue(
      responseWith({ session_id: 'session-1', recipient_id: USER_ID })
    );
    const { rerender } = await renderHook(
      ({ userId }: { userId: string | undefined }) => useNotificationResponse(userId),
      { initialProps: { userId: undefined } }
    );

    await rerender({ userId: USER_ID });

    await waitFor(() =>
      expect(mockPush).toHaveBeenCalledWith({ pathname: '/sessions/[id]', params: { id: 'session-1' } })
    );
  });

  it('アプリを開いている間に自分宛ての通知をタップしたら、そのセッション詳細を開く', async () => {
    await renderHook(() => useNotificationResponse(USER_ID));

    tap(responseWith({ session_id: 'session-2', recipient_id: USER_ID }));

    expect(mockPush).toHaveBeenCalledWith({ pathname: '/sessions/[id]', params: { id: 'session-2' } });
  });

  it('同じ通知のタップが2回届いても、セッション詳細は1回だけ開く', async () => {
    const response = responseWith({ session_id: 'session-1', recipient_id: USER_ID });
    mockNotifications.getLastNotificationResponseAsync.mockResolvedValue(response);

    await renderHook(() => useNotificationResponse(USER_ID));
    await waitFor(() => expect(mockPush).toHaveBeenCalled());
    tap(response);

    expect(mockPush).toHaveBeenCalledTimes(1);
  });

  it('通知の本体ではなくアクションボタンが押されたなら、画面を移らない', async () => {
    await renderHook(() => useNotificationResponse(USER_ID));

    tap(responseWith({ session_id: 'session-1', recipient_id: USER_ID }, { actionIdentifier: 'reply' }));

    expect(mockPush).not.toHaveBeenCalled();
  });

  it('タップした通知に session_id が無いなら、画面を移らない', async () => {
    await renderHook(() => useNotificationResponse(USER_ID));

    tap(responseWith({ recipient_id: USER_ID }));

    expect(mockPush).not.toHaveBeenCalled();
  });

  it('タップした通知の session_id が文字列でないなら、画面を移らない', async () => {
    await renderHook(() => useNotificationResponse(USER_ID));

    tap(responseWith({ session_id: 123, recipient_id: USER_ID }));

    expect(mockPush).not.toHaveBeenCalled();
  });

  it('タップした通知に recipient_id が無いなら、画面を移らない', async () => {
    await renderHook(() => useNotificationResponse(USER_ID));

    tap(responseWith({ session_id: 'session-1' }));

    expect(mockPush).not.toHaveBeenCalled();
  });

  it('Webなら、通知のタップを読まない', async () => {
    jest.replaceProperty(Platform, 'OS', 'web');

    await renderHook(() => useNotificationResponse(USER_ID));

    expect(mockNotifications.getLastNotificationResponseAsync).not.toHaveBeenCalled();
    expect(mockNotifications.addNotificationResponseReceivedListener).not.toHaveBeenCalled();
  });
});
