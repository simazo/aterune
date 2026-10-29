// src/app 配下には routes / layouts 以外を置けないため、レイアウトのテストはここに置く
import TabsLayout from '@/app/(app)/(tabs)/_layout';
import AppLayout from '@/app/(app)/_layout';
import AuthLayout from '@/app/(auth)/_layout';
import TermsScreen from '@/app/terms';
import { useAuth } from '@/hooks/use-auth';
import { useReplaceAfterDismiss } from '@/hooks/use-replace-after-dismiss';
import { RootNavigator } from '@/navigation/root-navigator';
import { router as expoRouter } from 'expo-router';
import { act, fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import { useSyncExternalStore } from 'react';
import { Pressable, Text, TextInput } from 'react-native';

jest.mock('@/hooks/use-auth', () => ({ useAuth: jest.fn() }));
// タブのヘッダーのベルは未読の件数を Supabase から読むため、何も描かないものに差し替える（このテストの対象外）
jest.mock('@/components/notification-bell', () => ({ NotificationBell: () => null }));
// 利用規約は、ルートファイル（@/app/terms）の置き場所だけを確かめるため、画面の中身を文言だけに差し替える
jest.mock('@/screens/terms', () => {
  const { Text: MockText } = jest.requireActual('react-native');
  return { Terms: () => <MockText>利用規約の画面</MockText> };
});

const mockUseAuth = jest.mocked(useAuth);

// 描画したあとにログイン・ログアウトさせるテストがあるため、ログイン状態を変えたら useAuth を使う画面が描画し直されるようにする
let isSignedIn = false;
const authListeners = new Set<() => void>();

function subscribeAuth(listener: () => void) {
  authListeners.add(listener);
  return () => {
    authListeners.delete(listener);
  };
}

mockUseAuth.mockImplementation(() => {
  const signedIn = useSyncExternalStore(subscribeAuth, () => isSignedIn);
  return { session: signedIn ? { user: { id: 'user-1' } } : null, loading: false } as never;
});

function setSignedIn(signedIn: boolean) {
  isSignedIn = signedIn;
  authListeners.forEach((listener) => listener());
}

// どちらのグループにも入らない画面（/auth/confirmed・/auth/reset-password）の、別の画面へ移るボタンの代わり
function LeaveButtons() {
  const replaceAfterDismiss = useReplaceAfterDismiss();

  return (
    <>
      <Pressable onPress={() => replaceAfterDismiss('/')}>
        <Text>ホームへ移る</Text>
      </Pressable>
      <Pressable onPress={() => replaceAfterDismiss('/login')}>
        <Text>ログイン画面へ移る</Text>
      </Pressable>
    </>
  );
}

function ConfirmedScreen() {
  return (
    <>
      <Text>メール確認の完了画面</Text>
      <LeaveButtons />
    </>
  );
}

function ResetPasswordScreen() {
  return (
    <>
      <Text>新しいパスワードの設定画面</Text>
      <LeaveButtons />
    </>
  );
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
      '(auth)/signup': () => <TextInput placeholder="ニックネーム" />,
      '(auth)/forgot-password': () => <Text>パスワード再設定メールの送信画面</Text>,
      'auth/confirmed': ConfirmedScreen,
      'auth/reset-password': ResetPasswordScreen,
      terms: TermsScreen,
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

// 利用規約は新規登録の前にも読めるよう、どちらのグループにも属さない場所に置いている
describe('/terms', () => {
  it.each([
    ['ログイン済み', true],
    ['未ログイン', false],
  ])('%sでもリダイレクトせずに表示する', async (_label, signedIn) => {
    setSignedIn(signedIn);

    const router = renderApp('/terms');
    await router;

    expect(router.getPathname()).toBe('/terms');
    expect(screen.getByText('利用規約の画面')).toBeOnTheScreen();
  });
});

// ルートを Stack にして、どちらのグループにも入らない画面を元の画面の上に重ねる
describe('ルートのナビゲーター', () => {
  it('マイページからどちらのグループにも入らない画面を開いて戻ると、マイページに戻る', async () => {
    setSignedIn(true);

    const router = renderApp('/mypage');
    await router;
    await act(async () => expoRouter.push('/terms'));
    await act(async () => expoRouter.back());

    expect(router.getPathname()).toBe('/mypage');
    expect(screen.getByText('マイページ画面')).toBeOnTheScreen();
  });

  it('新規登録からどちらのグループにも入らない画面を開いて戻ると、入力が残っている', async () => {
    setSignedIn(false);

    const router = renderApp('/signup');
    await router;
    await fireEvent.changeText(screen.getByPlaceholderText('ニックネーム'), 'みらい');
    await act(async () => expoRouter.push('/terms'));
    await act(async () => expoRouter.back());

    expect(router.getPathname()).toBe('/signup');
    expect(screen.getByDisplayValue('みらい')).toBeOnTheScreen();
  });

  it('ログインして (app) に切り替わったあとは、ログイン画面へ戻れない', async () => {
    setSignedIn(false);

    const router = renderApp('/login');
    await router;
    await act(async () => setSignedIn(true));

    expect(router.getPathname()).toBe('/');
    expect(expoRouter.canGoBack()).toBe(false);
  });

  it('ログアウトして (auth) に切り替わったあとは、元の画面へ戻れない', async () => {
    setSignedIn(true);

    const router = renderApp('/mypage');
    await router;
    await act(async () => setSignedIn(false));

    expect(router.getPathname()).toBe('/login');
    expect(expoRouter.canGoBack()).toBe(false);
  });
});

// メールのリンクで開くと、ログイン画面の上に重なる。そこから移ったあとに、戻るで下の画面へ戻れないようにする
describe.each(['/auth/confirmed', '/auth/reset-password'] as const)('%s から移るボタン', (pathname) => {
  it('リンクでログインしてからホームへ移ると、戻れない', async () => {
    setSignedIn(false);

    const router = renderApp('/login');
    await router;
    await act(async () => expoRouter.push(pathname));
    await act(async () => setSignedIn(true));
    await fireEvent.press(screen.getByText('ホームへ移る'));

    expect(router.getPathname()).toBe('/');
    expect(screen.getByText('占い師検索画面')).toBeOnTheScreen();
    expect(expoRouter.canGoBack()).toBe(false);
  });

  // Web の再読み込みや、アプリが起動していないときにリンクを開いた場合など、下に画面が無いとき
  it('直接開いてからホームへ移ると、戻れない', async () => {
    setSignedIn(true);

    const router = renderApp(pathname);
    await router;
    await fireEvent.press(screen.getByText('ホームへ移る'));

    expect(router.getPathname()).toBe('/');
    expect(screen.getByText('占い師検索画面')).toBeOnTheScreen();
    expect(expoRouter.canGoBack()).toBe(false);
  });

  it('未ログインのままログイン画面へ移ると、戻れない', async () => {
    setSignedIn(false);

    const router = renderApp('/login');
    await router;
    await act(async () => expoRouter.push(pathname));
    await fireEvent.press(screen.getByText('ログイン画面へ移る'));

    expect(router.getPathname()).toBe('/login');
    expect(expoRouter.canGoBack()).toBe(false);
  });
});
