import { getAuthErrorMessage } from './auth-error';

const FALLBACK_MESSAGE = 'エラーが発生しました。時間をおいて、もう一度お試しください';

describe('getAuthErrorMessage', () => {
  test.each([
    ['invalid_credentials', 'メールアドレスまたはパスワードが正しくありません'],
    [
      'email_not_confirmed',
      'メールアドレスの確認が完了していません。確認メールのリンクから登録を完了してください',
    ],
    ['user_already_exists', 'このメールアドレスはすでに登録されています'],
    ['email_exists', 'このメールアドレスはすでに登録されています'],
    ['weak_password', 'パスワードが簡単すぎます。別のパスワードを設定してください'],
    ['same_password', '今と同じパスワードは設定できません。別のパスワードを入力してください'],
    ['email_address_invalid', 'このメールアドレスは使用できません'],
    [
      'over_email_send_rate_limit',
      'メールの送信回数が上限に達しました。しばらく時間をおいて、もう一度お試しください',
    ],
    [
      'over_request_rate_limit',
      '短時間に操作が集中しています。しばらく時間をおいて、もう一度お試しください',
    ],
    ['signup_disabled', '現在、新規登録を受け付けていません'],
    ['user_banned', 'このアカウントは利用が停止されています'],
  ])('code が %s なら対応する日本語の文言を返す', (code, expected) => {
    expect(getAuthErrorMessage({ code })).toBe(expected);
  });

  test('分からない code なら共通の文言を返す', () => {
    expect(getAuthErrorMessage({ code: 'unexpected_failure' })).toBe(FALLBACK_MESSAGE);
  });

  test('code が無い（通信エラーなど）なら共通の文言を返す', () => {
    expect(getAuthErrorMessage({ code: undefined })).toBe(FALLBACK_MESSAGE);
  });
});
