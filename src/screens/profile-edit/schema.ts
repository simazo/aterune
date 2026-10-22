import { getTodayString, parseDateString } from '@/utils/date';
import { z } from 'zod';

// 文字数の上限・性別の値は DB の CHECK と合わせる
export const profileEditSchema = z.object({
  // スペースだけの入力を弾くため、前後の空白を除いてから文字数をチェックする
  displayName: z
    .string()
    .trim()
    .min(1, '表示名を入力してください')
    .max(20, '表示名は20文字以内で入力してください'),
  bio: z.string().trim().max(200, '自己紹介は200文字以内で入力してください'),
  // 生年月日は年・月・日の Select で選び、3つとも選んだときだけ 'YYYY-MM-DD'、未選択・選び途中なら ''。
  // '' は保存時に今の値を変えない（選び途中で保存して、登録済みの生年月日が消えないようにする）
  birthdate: z
    .string()
    .refine((value) => value === '' || parseDateString(value) !== null, '正しい日付を選択してください')
    .refine((value) => value === '' || value <= getTodayString(), '未来の日付は選択できません'),
  // null は「回答しない」
  gender: z.enum(['female', 'male', 'other']).nullable(),
});

export type ProfileEditFormValues = z.infer<typeof profileEditSchema>;
