import { Constants } from '@/types/database.types';
import { z } from 'zod';

// 通報の入力。理由は DB の enum report_reason の値から1つ必須、詳しい内容は任意。
// 詳しい内容は空白だけの入力を空にするため、前後の空白を除いてから文字数をチェックする
// （文字数の上限は DB の CHECK と合わせる）
export const reportSchema = z.object({
  reason: z.enum(Constants.public.Enums.report_reason, { error: '理由を選んでください' }),
  detail: z.string().trim().max(500, '詳しい内容は500文字以内で入力してください'),
});

export type ReportFormValues = z.infer<typeof reportSchema>;
