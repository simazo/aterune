// src/app 配下には routes / layouts 以外を置けないため、レイアウトのテストはここに置く
import AppLayout from '@/app/(app)/_layout';
import AuthLayout from '@/app/(auth)/_layout';
import { useAuth } from '@/hooks/use-auth';
import { renderRouter, screen } from 'expo-router/testing-library';
import { Text } from 'react-native';

jest.mock('@/hooks/use-auth', () => ({ useAuth: jest.fn() }));

const mockUseAuth = jest.mocked(useAuth);

function setSignedIn(signedIn: boolean) {
  mockUseAuth.mockReturnValue({
    session: signedIn ? { user: { id: 'user-1' } } : null,
    loading: false,
  } as never);
}

// 本物の (app) / (auth) レイアウトに、文言を出すだけの仮の画面を組み合わせる。
// getPathname() は renderRouter の戻り値（Promise）に付くため、呼び出し側で戻り値を保持したまま await する。
// expo-router の toHavePathname は型定義が無いので使わない
function renderApp(initialUrl: string) {
  return renderRouter(
    {
      '(app)/_layout': AppLayout,
      '(app)/index': () => <Text>ホーム</Text>,
      '(auth)/_layout': AuthLayout,
      '(auth)/login': () => <Text>ログイン</Text>,
    },
    { initialUrl }
  );
}

describe('(app) レイアウト', () => {
  it('未ログインならログイン画面へリダイレクトする', async () => {
    setSignedIn(false);

    const router = renderApp('/');
    await router;

    expect(router.getPathname()).toBe('/login');
    expect(screen.getByText('ログイン')).toBeOnTheScreen();
    expect(screen.queryByText('ホーム')).toBeNull();
  });

  it('ログイン済みならそのまま画面を表示する', async () => {
    setSignedIn(true);

    const router = renderApp('/');
    await router;

    expect(router.getPathname()).toBe('/');
    expect(screen.getByText('ホーム')).toBeOnTheScreen();
  });
});

describe('(auth) レイアウト', () => {
  it('ログイン済みならホームへリダイレクトする', async () => {
    setSignedIn(true);

    const router = renderApp('/login');
    await router;

    expect(router.getPathname()).toBe('/');
    expect(screen.getByText('ホーム')).toBeOnTheScreen();
    expect(screen.queryByText('ログイン')).toBeNull();
  });

  it('未ログインならそのまま画面を表示する', async () => {
    setSignedIn(false);

    const router = renderApp('/login');
    await router;

    expect(router.getPathname()).toBe('/login');
    expect(screen.getByText('ログイン')).toBeOnTheScreen();
  });
});
