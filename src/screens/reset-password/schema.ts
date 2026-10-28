import { z } from 'zod';

export const resetPasswordSchema = z
  .object({
    // 文字数の下限は新規登録と、Supabase Auth の minimum_password_length に合わせる
    password: z.string().min(6, 'パスワードは6文字以上で入力してください'),
    passwordConfirm: z.string().min(1, 'パスワード（確認用）を入力してください'),
  })
  .refine((values) => values.password === values.passwordConfirm, {
    message: 'パスワードが一致しません',
    path: ['passwordConfirm'],
  });

export type ResetPasswordFormValues = z.infer<typeof resetPasswordSchema>;
