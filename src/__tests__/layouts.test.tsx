// src/app 配下には routes / layouts 以外を置けないため、レイアウトのテストはここに置く
import TabsLayout from '@/app/(app)/(tabs)/_layout';
import AppLayout from '@/app/(app)/_layout';
import AuthLayout from '@/app/(auth)/_layout';
import { useAuth } from '@/hooks/use-auth';
import { RootNavigator } from '@/navigation/root-navigator';
import { renderRouter, screen } from 'expo-router/testing-library';
import { Text } from 'react-native';

jest.mock('@/hooks/use-auth', () => ({ useAuth: jest.fn() }));
// タブのヘッダーのベルは未読の件数を Supabase から読むため、何も描かないものに差し替える（このテストの対象外）
jest.mock('@/components/notification-bell', () => ({ NotificationBell: () => null }));

const mockUseAuth = jest.mocked(useAuth);

function setSignedIn(signedIn: boolean) {
  mockUseAuth.mockReturnValue({
    session: signedIn ? { user: { id: 'user-1' } } : null,
    loading: false,
  } as never);
}

// 本物のルートのナビゲーターと (app) / (tabs) / (auth) レイアウトに、文言を出すだけの仮の画面を組み合わせる。
// 画面の文言は、タブのラベル（占い師を探す・お悩みを探す・やり取り・マイページ）と重ならないようにする。
// getPathname() は renderRouter の戻り値（Promise）に付くため、呼び出し側で戻り値を保持したまま await する。
// expo-router の toHavePathname は型定義が無いので使わない
function renderApp(initialUrl: string) {
  return renderRouter(
    {
      _layout: RootNavigator,
      '(app)/_layout': AppLayout,
      '(app)/(tabs)/_layout': TabsLayout,
      '(app)/(tabs)/index': () => <Text>占い師検索画面</Text>,
      '(app)/(tabs)/concerns': () => <Text>お悩み一覧画面</Text>,
      '(app)/(tabs)/messages': () => <Text>メッセージ画面</Text>,
      '(app)/(tabs)/mypage': () => <Text>マイページ画面</Text>,
      '(auth)/_layout': AuthLayout,
      '(auth)/login': () => <Text>ログイン</Text>,
      '(auth)/forgot-password': () => <Text>パスワード再設定メールの送信画面</Text>,
      'auth/reset-password': () => <Text>新しいパスワードの設定画面</Text>,
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
    expect(screen.queryByText('占い師検索画面')).toBeNull();
  });

  it('未ログインでタブの画面を直接開いてもログイン画面へリダイレクトする', async () => {
    setSignedIn(false);

    const router = renderApp('/messages');
    await router;

    expect(router.getPathname()).toBe('/login');
    expect(screen.getByText('ログイン')).toBeOnTheScreen();
    expect(screen.queryByText('メッセージ画面')).toBeNull();
  });

  it('ログイン済みならそのまま画面を表示する', async () => {
    setSignedIn(true);

    const router = renderApp('/');
    await router;

    expect(router.getPathname()).toBe('/');
    expect(screen.getByText('占い師検索画面')).toBeOnTheScreen();
  });
});

describe('(auth) レイアウト', () => {
  it('ログイン済みなら占い師検索のタブへリダイレクトする', async () => {
    setSignedIn(true);

    const router = renderApp('/login');
    await router;

    expect(router.getPathname()).toBe('/');
    expect(screen.getByText('占い師検索画面')).toBeOnTheScreen();
    expect(screen.queryByText('ログイン')).toBeNull();
  });

  it('未ログインならそのまま画面を表示する', async () => {
    setSignedIn(false);

    const router = renderApp('/login');
    await router;

    expect(router.getPathname()).toBe('/login');
    expect(screen.getByText('ログイン')).toBeOnTheScreen();
  });

  it('ログイン済みでパスワード再設定メールの送信画面を開くと占い師検索のタブへリダイレクトする', async () => {
    setSignedIn(true);

    const router = renderApp('/forgot-password');
    await router;

    expect(router.getPathname()).toBe('/');
    expect(screen.getByText('占い師検索画面')).toBeOnTheScreen();
    expect(screen.queryByText('パスワード再設定メールの送信画面')).toBeNull();
  });

  it('未ログインならパスワード再設定メールの送信画面をそのまま表示する', async () => {
    setSignedIn(false);

    const router = renderApp('/forgot-password');
    await router;

    expect(router.getPathname()).toBe('/forgot-password');
    expect(screen.getByText('パスワード再設定メールの送信画面')).toBeOnTheScreen();
  });
});

// メールのリンクで戻った時点でログイン状態になるため、どちらのグループにも属さない /auth/ の下に置いている
describe('/auth/reset-password', () => {
  it.each([
    ['ログイン済み', true],
    ['未ログイン', false],
  ])('%sでもリダイレクトせずに表示する', async (_label, signedIn) => {
    setSignedIn(signedIn);

    const router = renderApp('/auth/reset-password');
    await router;

    expect(router.getPathname()).toBe('/auth/reset-password');
    expect(screen.getByText('新しいパスワードの設定画面')).toBeOnTheScreen();
  });
});
