import { AuthContext } from '@/providers/auth-provider';
import type { Session } from '@supabase/supabase-js';
import { renderHook } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { useAuth } from './use-auth';

// auth-provider が import する supabase クライアントを初期化させない
jest.mock('@/lib/supabase', () => ({ supabase: {} }));

afterEach(() => {
  jest.restoreAllMocks();
});

describe('useAuth', () => {
  it('AuthProviderの外で呼ぶと例外を投げる', async () => {
    // React が投げられたエラーを console.error に出すので黙らせる
    jest.spyOn(console, 'error').mockImplementation(() => {});

    await expect(renderHook(() => useAuth())).rejects.toThrow(
      'useAuth must be used within an AuthProvider'
    );
  });

  it('AuthProviderの中ではcontextの値を返す', async () => {
    const value = { session: { user: { id: 'user-1' } } as Session, loading: false };
    const wrapper = ({ children }: { children: ReactNode }) => (
      <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
    );

    const { result } = await renderHook(() => useAuth(), { wrapper });

    expect(result.current).toBe(value);
  });
});
