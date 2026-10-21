import { Textarea } from '@/components/ui/textarea';
import type { ComponentProps } from 'react';

type Props = ComponentProps<typeof Textarea>;

// 背景を塗った複数行の入力欄の枠（中身は TextareaInput をそのまま渡す）。
// gluestack の Textarea はライトで背景が透明なため、色付きの画面背景に溶け込む。カードと同じ背景にして浮かせる
// （ダークは Textarea 側の dark:bg-input/30 がそのまま効く）
export function FilledTextarea({ className, ...props }: Props) {
  return <Textarea className={`bg-card ${className ?? ''}`} {...props} />;
}
