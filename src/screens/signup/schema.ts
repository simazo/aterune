import { z } from 'zod';

export const signupSchema = z.object({
  displayName: z.string().min(1, '表示名を入力してください'),
  email: z
    .string()
    .min(1, 'メールアドレスを入力してください')
    .email('メールアドレスの形式が正しくありません'),
  password: z.string().min(6, 'パスワードは6文字以上で入力してください'),
});

export type SignupFormValues = z.infer<typeof signupSchema>;
