import { z } from 'zod';

// 選んだタグは種類ごとに ID で持つ（占術が1つ以上あるかを確かめるため）。文字数の上限は DB の CHECK と合わせる
export const tellerProfileEditSchema = z.object({
  divinationTagIds: z.array(z.string()).min(1, '占術を1つ以上選んでください'),
  concernTagIds: z.array(z.string()),
  styleTagIds: z.array(z.string()),
  // 前後の空白を除いてから文字数をチェックする（スペースだけなら空＝未入力として保存する）
  selfPr: z.string().trim().max(1000, '自己PRは1000文字以内で入力してください'),
  trainingPeriod: z.string().trim().max(20, '修行期間は20文字以内で入力してください'),
  isAccepting: z.boolean(),
  requiresBirthdate: z.boolean(),
});

export type TellerProfileEditFormValues = z.infer<typeof tellerProfileEditSchema>;
