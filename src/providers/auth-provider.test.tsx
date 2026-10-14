import { useAuth } from '@/hooks/use-auth';
import { supabase } from '@/lib/supabase';
import type { AuthChangeEvent, Session } from '@supabase/supabase-js';
import { act, renderHook } from '@testing-library/react-native';
import { AuthProvider } from './auth-provider';

jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: jest.fn(),
      onAuthStateChange: jest.fn(),
    },
  },
}));

const SESSION = { user: { id: 'user-1' } } as Session;
const mockAuth = jest.mocked(supabase.auth);
const unsubscribe = jest.fn();
// onAuthStateChange に渡されたコールバック。テストから呼んでログイン・ログアウトを再現する
let emitAuthChange: (event: AuthChangeEvent, session: Session | null) => void;

beforeEach(() => {
  jest.clearAllMocks();
  mockAuth.getSession.mockResolvedValue({ data: { session: null }, error: null } as never);
  mockAuth.onAuthStateChange.mockImplementation((callback) => {
    emitAuthChange = callback as typeof emitAuthChange;
    return { data: { subscription: { unsubscribe } } } as never;
  });
});

function renderAuth() {
  return renderHook(() => useAuth(), { wrapper: AuthProvider });
}

describe('AuthProvider', () => {
  it('getSessionの結果が返るまではloading中でsessionはnull', async () => {
    mockAuth.getSession.mockReturnValue(new Promise(() => {}));

    const { result } = await renderAuth();

    expect(result.current).toEqual({ session: null, loading: true });
  });

  it('getSessionがセッションを返したらsessionを持ちloadingを終える', async () => {
    mockAuth.getSession.mockResolvedValue({ data: { session: SESSION }, error: null } as never);

    const { result } = await renderAuth();

    expect(result.current).toEqual({ session: SESSION, loading: false });
  });

  it('未ログインならsessionはnullのままloadingを終える', async () => {
    const { result } = await renderAuth();

    expect(result.current).toEqual({ session: null, loading: false });
  });

  it('onAuthStateChangeでログイン・ログアウトするとsessionが切り替わる', async () => {
    const { result } = await renderAuth();

    await act(() => emitAuthChange('SIGNED_IN', SESSION));
    expect(result.current.session).toBe(SESSION);

    await act(() => emitAuthChange('SIGNED_OUT', null));
    expect(result.current.session).toBeNull();
  });

  it('アンマウントすると購読を解除する', async () => {
    const { unmount } = await renderAuth();

    expect(unsubscribe).not.toHaveBeenCalled();
    await act(() => unmount());
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });
});
