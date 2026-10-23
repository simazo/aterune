import { z } from 'zod';

// お悩み投稿への応募。ひとことは任意で、上限は DB の CHECK（sessions.applicant_message）と合わせる
export const concernApplySchema = z.object({
  // スペースだけの入力を空にするため、前後の空白を除いてから文字数をチェックする
  message: z.string().trim().max(100, 'ひとことは100文字以内で入力してください'),
});

export type ConcernApplyFormValues = z.infer<typeof concernApplySchema>;
