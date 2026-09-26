import { loginSchema } from './schema';

describe('loginSchema', () => {
  it('メールアドレスとパスワードが正しく入力されていれば通る', () => {
    const result = loginSchema.safeParse({ email: 'user@example.com', password: 'password' });

    expect(result.success).toBe(true);
  });
});
