import { z } from 'zod';

export const signupSchema = z.object({
  // スペースだけの表示名を弾くため、前後の空白を除いてから文字数をチェックする
  // 文字数の上限は DB の CHECK と合わせる
  displayName: z
    .string()
    .trim()
    .min(1, '表示名を入力してください')
    .max(20, '表示名は20文字以内で入力してください'),
  email: z
    .string()
    .min(1, 'メールアドレスを入力してください')
    .email('メールアドレスの形式が正しくありません'),
  password: z.string().min(6, 'パスワードは6文字以上で入力してください'),
  // 同意したかどうかは DB に記録しない（同意の日時・規約の版の記録は #44 の範囲外）
  agreedToTerms: z.boolean().refine((agreed) => agreed, '利用規約への同意が必要です'),
});

export type SignupFormValues = z.infer<typeof signupSchema>;
