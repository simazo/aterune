import { z } from 'zod';

// お悩みの投稿。悩みの種類（悩みタグ）は1つ必須、内容の上限は DB の CHECK と合わせる
export const concernNewSchema = z.object({
  concernTagId: z.string().min(1, '悩みの種類を選んでください'),
  // スペースだけの入力を弾くため、前後の空白を除いてから文字数をチェックする
  concern: z
    .string()
    .trim()
    .min(1, 'お悩みの内容を入力してください')
    .max(1000, 'お悩みの内容は1000文字以内で入力してください'),
});

export type ConcernNewFormValues = z.infer<typeof concernNewSchema>;
