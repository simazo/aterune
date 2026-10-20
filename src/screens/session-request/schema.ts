import { parseDateString, toDateString } from '@/utils/date';
import { z } from 'zod';

// 端末の日付で今日を 'YYYY-MM-DD' にする（同じ形の文字列どうしなら、文字列の比較で日付の前後が分かる）
function getTodayString() {
  const now = new Date();
  return toDateString(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

// 生年月日は年・月・日の Select で選び、3つとも選んだときだけ 'YYYY-MM-DD'、選び途中なら '' が入る
const birthdateSchema = z
  .string()
  .min(1, '生年月日を選択してください')
  .refine((value) => parseDateString(value) !== null, '正しい日付を選択してください')
  .refine((value) => value <= getTodayString(), '未来の日付は選択できません');

// 生年月日は、占い師が必須にしているときだけチェックする（文字数の上限は DB の CHECK と合わせる）
export function buildSessionRequestSchema(requiresBirthdate: boolean) {
  return z.object({
    // スペースだけの入力を弾くため、前後の空白を除いてから文字数をチェックする
    concern: z
      .string()
      .trim()
      .min(1, '相談内容を入力してください')
      .max(1000, '相談内容は1000文字以内で入力してください'),
    message: z.string().trim().max(100, 'ひとことは100文字以内で入力してください'),
    birthdate: requiresBirthdate ? birthdateSchema : z.string(),
  });
}

export type SessionRequestFormValues = z.infer<ReturnType<typeof buildSessionRequestSchema>>;
