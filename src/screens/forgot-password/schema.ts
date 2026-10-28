import { z } from 'zod';

export const forgotPasswordSchema = z.object({
  email: z
    .string()
    .min(1, 'メールアドレスを入力してください')
    .email('メールアドレスの形式が正しくありません'),
});

export type ForgotPasswordFormValues = z.infer<typeof forgotPasswordSchema>;
