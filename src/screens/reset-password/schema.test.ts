import { resetPasswordSchema } from './schema';

const validValues = {
  password: 'new-secret',
  passwordConfirm: 'new-secret',
};

function firstError(values: unknown) {
  const result = resetPasswordSchema.safeParse(values);
  if (result.success) return undefined;
  const { message, path } = result.error.issues[0];
  return { message, path };
}

describe('resetPasswordSchema', () => {
  it('6文字以上で、確認用と一致していれば通る', () => {
    expect(resetPasswordSchema.safeParse(validValues).success).toBe(true);
  });

  it('パスワードが6文字なら通る', () => {
    expect(
      resetPasswordSchema.safeParse({ password: '123456', passwordConfirm: '123456' }).success
    ).toBe(true);
  });

  it('パスワードが5文字ならエラー', () => {
    expect(firstError({ password: '12345', passwordConfirm: '12345' })).toEqual({
      message: 'パスワードは6文字以上で入力してください',
      path: ['password'],
    });
  });

  it('確認用が空ならエラー', () => {
    expect(firstError({ ...validValues, passwordConfirm: '' })).toEqual({
      message: 'パスワード（確認用）を入力してください',
      path: ['passwordConfirm'],
    });
  });

  it('確認用と一致しなければ確認用の欄にエラーを出す', () => {
    expect(firstError({ ...validValues, passwordConfirm: 'new-secreT' })).toEqual({
      message: 'パスワードが一致しません',
      path: ['passwordConfirm'],
    });
  });
});
