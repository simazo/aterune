import { signupSchema } from './schema';

const validValues = {
  displayName: 'テストユーザー',
  email: 'user@example.com',
  password: 'secret',
};

function firstErrorMessage(values: unknown) {
  const result = signupSchema.safeParse(values);
  return result.success ? undefined : result.error.issues[0].message;
}

describe('signupSchema', () => {
  it('すべて正しく入力されていれば通る', () => {
    expect(signupSchema.safeParse(validValues).success).toBe(true);
  });

  it('表示名が空ならエラー', () => {
    expect(firstErrorMessage({ ...validValues, displayName: '' })).toBe(
      '表示名を入力してください'
    );
  });

  it('表示名がスペースだけならエラー', () => {
    expect(firstErrorMessage({ ...validValues, displayName: '　 ' })).toBe(
      '表示名を入力してください'
    );
  });

  it('表示名の前後のスペースは取り除かれる', () => {
    const result = signupSchema.safeParse({ ...validValues, displayName: ' テストユーザー ' });

    expect(result.success && result.data.displayName).toBe('テストユーザー');
  });

  it('メールアドレスが空ならエラー', () => {
    expect(firstErrorMessage({ ...validValues, email: '' })).toBe(
      'メールアドレスを入力してください'
    );
  });

  it('メールアドレスの形式が正しくなければエラー', () => {
    expect(firstErrorMessage({ ...validValues, email: 'user@' })).toBe(
      'メールアドレスの形式が正しくありません'
    );
  });

  it('パスワードが5文字ならエラー', () => {
    expect(firstErrorMessage({ ...validValues, password: '12345' })).toBe(
      'パスワードは6文字以上で入力してください'
    );
  });

  it('パスワードが6文字なら通る', () => {
    expect(signupSchema.safeParse({ ...validValues, password: '123456' }).success).toBe(true);
  });
});
