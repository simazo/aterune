import { loginSchema } from './schema';

function firstErrorMessage(values: unknown) {
  const result = loginSchema.safeParse(values);
  return result.success ? undefined : result.error.issues[0].message;
}

describe('loginSchema', () => {
  it('メールアドレスとパスワードが正しく入力されていれば通る', () => {
    const result = loginSchema.safeParse({ email: 'user@example.com', password: 'password' });

    expect(result.success).toBe(true);
  });

  it('メールアドレスが空ならエラー', () => {
    expect(firstErrorMessage({ email: '', password: 'password' })).toBe(
      'メールアドレスを入力してください'
    );
  });

  it('メールアドレスの形式が正しくなければエラー', () => {
    expect(firstErrorMessage({ email: 'user@', password: 'password' })).toBe(
      'メールアドレスの形式が正しくありません'
    );
  });

  it('パスワードが空ならエラー', () => {
    expect(firstErrorMessage({ email: 'user@example.com', password: '' })).toBe(
      'パスワードを入力してください'
    );
  });
});
