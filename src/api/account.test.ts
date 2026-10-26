import { dismissPushNotifications } from '@/lib/push-notifications';
import { supabase } from '@/lib/supabase';
import { FunctionsFetchError, FunctionsHttpError } from '@supabase/supabase-js';
import { deleteAccount } from './account';

jest.mock('@/lib/supabase', () => ({
  supabase: {
    functions: { invoke: jest.fn() },
    auth: { signOut: jest.fn() },
  },
}));

jest.mock('@/lib/push-notifications', () => ({
  dismissPushNotifications: jest.fn(),
}));

const mockInvoke = jest.mocked(supabase.functions.invoke);
const mockSignOut = jest.mocked(supabase.auth.signOut);
const mockDismissPushNotifications = jest.mocked(dismissPushNotifications);

beforeEach(() => {
  jest.clearAllMocks();
  mockSignOut.mockResolvedValue({ error: null });
});

describe('deleteAccount', () => {
  it('退会できたら、Edge Function を呼んだあとに通知欄を消し、この端末だけログアウトする', async () => {
    mockInvoke.mockResolvedValue({ data: { error: null }, error: null } as never);

    const result = await deleteAccount();

    expect(result).toEqual({ error: null });
    expect(mockInvoke).toHaveBeenCalledWith('delete-account');
    expect(mockSignOut).toHaveBeenCalledWith({ scope: 'local' });
    // サーバー側のセッションは退会で消えているので、Edge Function の成功後にだけ端末側を消す
    expect(mockInvoke.mock.invocationCallOrder[0]).toBeLessThan(
      mockDismissPushNotifications.mock.invocationCallOrder[0]
    );
    expect(mockDismissPushNotifications.mock.invocationCallOrder[0]).toBeLessThan(
      mockSignOut.mock.invocationCallOrder[0]
    );
  });

  it('進行中のセッションがあり 409 が返ったら has_active_session を返し、ログアウトしない', async () => {
    mockInvoke.mockResolvedValue({
      data: null,
      error: new FunctionsHttpError({ status: 409 }),
    } as never);

    const result = await deleteAccount();

    expect(result).toEqual({ error: 'has_active_session' });
    expect(mockDismissPushNotifications).not.toHaveBeenCalled();
    expect(mockSignOut).not.toHaveBeenCalled();
  });

  it('それ以外のエラーが返ったら failed を返し、ログアウトしない', async () => {
    mockInvoke.mockResolvedValue({
      data: null,
      error: new FunctionsHttpError({ status: 500 }),
    } as never);

    const result = await deleteAccount();

    expect(result).toEqual({ error: 'failed' });
    expect(mockDismissPushNotifications).not.toHaveBeenCalled();
    expect(mockSignOut).not.toHaveBeenCalled();
  });

  it('通信に失敗したら failed を返し、ログアウトしない', async () => {
    mockInvoke.mockResolvedValue({
      data: null,
      error: new FunctionsFetchError(new TypeError('Network request failed')),
    } as never);

    const result = await deleteAccount();

    expect(result).toEqual({ error: 'failed' });
    expect(mockSignOut).not.toHaveBeenCalled();
  });
});
