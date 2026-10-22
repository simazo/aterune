import { z } from 'zod';

// メッセージの入力。スペース・改行だけの入力を弾くため、前後の空白を除いてから文字数をチェックする
// （空白だけの禁止と文字数の上限は DB の CHECK と合わせる）
export const messageSchema = z.object({
  content: z
    .string()
    .trim()
    .min(1, 'メッセージを入力してください')
    .max(1000, 'メッセージは1000文字以内で入力してください'),
});

export type MessageFormValues = z.infer<typeof messageSchema>;
