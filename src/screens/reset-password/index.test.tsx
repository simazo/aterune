import { createSessionFromUrl, updatePassword } from '@/api/auth';
import { savePushTokenForCurrentUser } from '@/api/push-tokens';
import { useAuth } from '@/hooks/use-auth';
import { useErrorToast } from '@/hooks/use-error-toast';
import { useSuccessToast } from '@/hooks/use-success-toast';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { useLinkingURL } from 'expo-linking';
import { useRouter } from 'expo-router';
import { ResetPassword } from '.';

jest.mock('@/api/auth', () => ({
  createSessionFromUrl: jest.fn(),
  updatePassword: jest.fn(),
}));
jest.mock('@/api/push-tokens', () => ({ savePushTokenForCurrentUser: jest.fn() }));
jest.mock('@/hooks/use-auth', () => ({ useAuth: jest.fn() }));
jest.mock('@/hooks/use-error-toast', () => ({ useErrorToast: jest.fn() }));
jest.mock('@/hooks/use-success-toast', () => ({ useSuccessToast: jest.fn() }));
jest.mock('expo-linking', () => ({ useLinkingURL: jest.fn() }));
jest.mock('expo-router', () => ({ useRouter: jest.fn() }));

const mockCreateSessionFromUrl = jest.mocked(createSessionFromUrl);
const mockUpdatePassword = jest.mocked(updatePassword);
const mockSavePushToken = jest.mocked(savePushTokenForCurrentUser);
const mockUseAuth = jest.mocked(useAuth);
const mockUseLinkingURL = jest.mocked(useLinkingURL);
const mockShowError = jest.fn();
const mockShowSuccess = jest.fn();
const mockReplace = jest.fn();

const RESET_URL = 'aterune://auth/reset-password#access_token=AT&refresh_token=RT&type=recovery';

function setSignedIn(signedIn: boolean) {
  mockUseAuth.mockReturnValue({
    session: signedIn ? { user: { id: 'user-1' } } : null,
    loading: false,
  } as never);
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(useErrorToast).mockReturnValue(mockShowError);
  jest.mocked(useSuccessToast).mockReturnValue(mockShowSuccess);
  jest.mocked(useRouter).mockReturnValue({ replace: mockReplace } as never);
  mockUseLinkingURL.mockReturnValue(RESET_URL);
  setSignedIn(false);
});

async function fillAndSubmit(password: string) {
  await fireEvent.changeText(screen.getByPlaceholderText('新しいパスワード'), password);
  await fireEvent.changeText(screen.getByPlaceholderText('新しいパスワード（確認用）'), password);
  await fireEvent.press(screen.getByText('パスワードを変更する'));
}

describe('ResetPassword', () => {
  it('リンクから開いていなければ、入力欄を出さずに再設定メールの送り直しへ案内する', async () => {
    mockUseLinkingURL.mockReturnValue(null);

    await render(<ResetPassword />);

    expect(screen.queryByPlaceholderText('新しいパスワード')).toBeNull();
    expect(mockCreateSessionFromUrl).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByText('再設定メールを送り直す'));
    expect(mockReplace).toHaveBeenCalledWith('/forgot-password');
  });

  it('リンクが無効なら、入力欄を出さず push token も保存しない', async () => {
    mockCreateSessionFromUrl.mockResolvedValue({ status: 'error', errorCode: 'otp_expired' });

    await render(<ResetPassword />);

    expect(await screen.findByText('リンクが無効です')).toBeOnTheScreen();
    expect(screen.queryByPlaceholderText('新しいパスワード')).toBeNull();
    expect(mockSavePushToken).not.toHaveBeenCalled();
  });

  it('ログイン中にリンクから開いていなければ、送り直しではなくホームへ戻るボタンを出す', async () => {
    setSignedIn(true);
    mockUseLinkingURL.mockReturnValue(null);

    await render(<ResetPassword />);

    expect(screen.queryByPlaceholderText('新しいパスワード')).toBeNull();
    expect(screen.queryByText('再設定メールを送り直す')).toBeNull();

    await fireEvent.press(screen.getByText('ホームに戻る'));
    expect(mockReplace).toHaveBeenCalledWith('/');
  });

  it('リンクでログインできたら、push token を保存して入力欄を出す', async () => {
    mockCreateSessionFromUrl.mockResolvedValue({ status: 'success' });

    await render(<ResetPassword />);

    expect(await screen.findByPlaceholderText('新しいパスワード')).toBeOnTheScreen();
    expect(mockCreateSessionFromUrl).toHaveBeenCalledWith(RESET_URL);
    expect(mockSavePushToken).toHaveBeenCalled();
  });

  it('ログインできたあとにトークンなしのURLが届いても、入力欄を残す', async () => {
    // Web では #以降を消したあとの URL が、window の message イベントで届き直すことがある
    mockCreateSessionFromUrl.mockImplementation(async (url) =>
      url === RESET_URL ? { status: 'success' } : { status: 'no-params' }
    );
    await render(<ResetPassword />);
    await screen.findByPlaceholderText('新しいパスワード');

    mockUseLinkingURL.mockReturnValue('http://localhost:8081/auth/reset-password');
    await screen.rerender(<ResetPassword />);

    await waitFor(() => expect(mockCreateSessionFromUrl).toHaveBeenCalledTimes(2));
    expect(screen.getByPlaceholderText('新しいパスワード')).toBeOnTheScreen();
    expect(screen.queryByText('再設定メールを送り直す')).toBeNull();
  });

  it('パスワードの更新に失敗したら、エラーを出して移動せずに入力欄を残す', async () => {
    mockCreateSessionFromUrl.mockResolvedValue({ status: 'success' });
    mockUpdatePassword.mockResolvedValue({
      data: { user: null },
      error: { code: 'same_password' },
    } as never);
    await render(<ResetPassword />);
    await screen.findByPlaceholderText('新しいパスワード');

    await fillAndSubmit('new-secret');

    await waitFor(() =>
      expect(mockShowError).toHaveBeenCalledWith(
        '今と同じパスワードは設定できません。別のパスワードを入力してください'
      )
    );
    expect(mockReplace).not.toHaveBeenCalled();
    expect(screen.getByPlaceholderText('新しいパスワード')).toBeOnTheScreen();
  });

  it('パスワードを更新できたら、ログインしたまま / へ移動する', async () => {
    mockCreateSessionFromUrl.mockResolvedValue({ status: 'success' });
    mockUpdatePassword.mockResolvedValue({ data: { user: {} }, error: null } as never);
    await render(<ResetPassword />);
    await screen.findByPlaceholderText('新しいパスワード');

    await fillAndSubmit('new-secret');

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/'));
    expect(mockUpdatePassword).toHaveBeenCalledWith('new-secret');
    expect(mockShowSuccess).toHaveBeenCalledWith('パスワードを変更しました');
  });
});
