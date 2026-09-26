import { Platform } from 'react-native';
import { createSessionFromUrl, signOut, signUpWithEmail } from './auth';
import { deletePushTokenForCurrentDevice } from './pushToken';
import { supabase } from './supabase';

jest.mock('./supabase', () => ({
  supabase: {
    auth: {
      signUp: jest.fn(),
      setSession: jest.fn(),
      signOut: jest.fn(),
    },
  },
}));

jest.mock('./pushToken', () => ({
  deletePushTokenForCurrentDevice: jest.fn(),
}));

const mockAuth = jest.mocked(supabase.auth);
const mockDeletePushToken = jest.mocked(deletePushTokenForCurrentDevice);

afterEach(() => {
  // replacePropertyで差し替えたPlatform.OSを元に戻す
  jest.restoreAllMocks();
});

beforeEach(() => {
  jest.clearAllMocks();
});

describe('signUpWithEmail', () => {
  beforeEach(() => {
    mockAuth.signUp.mockResolvedValue({ data: {}, error: null } as never);
  });

  it('表示名をuser metadataに含め、モバイルではアプリのURLスキームを戻り先にする', async () => {
    await signUpWithEmail('user@example.com', 'secret', 'テストユーザー');

    expect(mockAuth.signUp).toHaveBeenCalledWith({
      email: 'user@example.com',
      password: 'secret',
      options: {
        data: { display_name: 'テストユーザー' },
        emailRedirectTo: 'aterune://auth/confirmed',
      },
    });
  });

  it('Webでは今開いているオリジンの/auth/confirmedを戻り先にする', async () => {
    jest.replaceProperty(Platform, 'OS', 'web');
    const originalWindow = globalThis.window;
    globalThis.window = { location: { origin: 'http://localhost:8081' } } as never;

    try {
      await signUpWithEmail('user@example.com', 'secret', 'テストユーザー');
    } finally {
      globalThis.window = originalWindow;
    }

    expect(mockAuth.signUp).toHaveBeenCalledWith(
      expect.objectContaining({
        options: expect.objectContaining({
          emailRedirectTo: 'http://localhost:8081/auth/confirmed',
        }),
      })
    );
  });
});

describe('createSessionFromUrl', () => {
  it('#以降のトークンでセッションを確立し、successを返す', async () => {
    mockAuth.setSession.mockResolvedValue({ data: {}, error: null } as never);

    const result = await createSessionFromUrl(
      'aterune://auth/confirmed#access_token=AT&refresh_token=RT&type=signup'
    );

    expect(mockAuth.setSession).toHaveBeenCalledWith({
      access_token: 'AT',
      refresh_token: 'RT',
    });
    expect(result).toEqual({ status: 'success' });
  });

  it('?以降に付いたトークンも読み取る', async () => {
    mockAuth.setSession.mockResolvedValue({ data: {}, error: null } as never);

    await createSessionFromUrl('aterune://auth/confirmed?access_token=AT&refresh_token=RT');

    expect(mockAuth.setSession).toHaveBeenCalledWith({
      access_token: 'AT',
      refresh_token: 'RT',
    });
  });

  it('リンクの期限切れなどでerrorが付いていれば、error_codeを返しセッションは確立しない', async () => {
    const result = await createSessionFromUrl(
      'aterune://auth/confirmed#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid'
    );

    expect(result).toEqual({ status: 'error', errorCode: 'otp_expired' });
    expect(mockAuth.setSession).not.toHaveBeenCalled();
  });

  it('errorにerror_codeが無ければerrorCodeはnull', async () => {
    const result = await createSessionFromUrl('aterune://auth/confirmed#error=server_error');

    expect(result).toEqual({ status: 'error', errorCode: null });
  });

  it('セッションの確立に失敗したらerrorを返す', async () => {
    mockAuth.setSession.mockResolvedValue({
      data: {},
      error: { code: 'bad_jwt' },
    } as never);

    const result = await createSessionFromUrl(
      'aterune://auth/confirmed#access_token=invalid&refresh_token=invalid'
    );

    expect(result).toEqual({ status: 'error', errorCode: 'bad_jwt' });
  });

  it('トークンもエラーも無ければno-paramsを返す', async () => {
    const result = await createSessionFromUrl('aterune://auth/confirmed');

    expect(result).toEqual({ status: 'no-params' });
    expect(mockAuth.setSession).not.toHaveBeenCalled();
  });

  it('refresh_tokenが欠けていればno-paramsを返す', async () => {
    const result = await createSessionFromUrl('aterune://auth/confirmed#access_token=AT');

    expect(result).toEqual({ status: 'no-params' });
    expect(mockAuth.setSession).not.toHaveBeenCalled();
  });
});

describe('signOut', () => {
  it('push tokenを削除してからサインアウトする', async () => {
    const calls: string[] = [];
    mockDeletePushToken.mockImplementation(async () => {
      calls.push('deletePushToken');
    });
    mockAuth.signOut.mockImplementation(async () => {
      calls.push('signOut');
      return { error: null };
    });

    await signOut();

    expect(calls).toEqual(['deletePushToken', 'signOut']);
  });
});
