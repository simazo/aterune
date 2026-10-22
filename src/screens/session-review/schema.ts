import { z } from 'zod';

// レビューの入力。評価は星の数（1〜5、未選択は 0）で必須、コメントは任意。
// コメントは空白だけの入力を空にするため、前後の空白を除いてから文字数をチェックする
// （評価の範囲とコメントの文字数の上限は DB の CHECK と合わせる）
export const reviewSchema = z.object({
  rating: z
    .number()
    .int('評価を選んでください')
    .min(1, '評価を選んでください')
    .max(5, '評価を選んでください'),
  comment: z.string().trim().max(500, 'コメントは500文字以内で入力してください'),
});

export type ReviewFormValues = z.infer<typeof reviewSchema>;
