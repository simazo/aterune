import { Input } from '@/components/ui/input';
import type { ComponentProps } from 'react';

type Props = ComponentProps<typeof Input>;

// 背景を塗った入力欄の枠（中身は InputField をそのまま渡す）。
// gluestack の Input はライトで背景が透明なため、色付きの画面背景に溶け込む。カードと同じ背景にして浮かせる
// （ダークは Input 側の dark:bg-input/30 がそのまま効く）
export function FilledInput({ className, ...props }: Props) {
  return <Input className={`bg-card ${className ?? ''}`} {...props} />;
}
