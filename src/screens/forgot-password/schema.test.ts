import { forgotPasswordSchema } from './schema';

function firstErrorMessage(values: unknown) {
  const result = forgotPasswordSchema.safeParse(values);
  return result.success ? undefined : result.error.issues[0].message;
}

describe('forgotPasswordSchema', () => {
  it('メールアドレスが正しく入力されていれば通る', () => {
    expect(forgotPasswordSchema.safeParse({ email: 'user@example.com' }).success).toBe(true);
  });

  it('メールアドレスが空ならエラー', () => {
    expect(firstErrorMessage({ email: '' })).toBe('メールアドレスを入力してください');
  });

  it('メールアドレスの形式が正しくなければエラー', () => {
    expect(firstErrorMessage({ email: 'user@' })).toBe('メールアドレスの形式が正しくありません');
  });
});
