import { CheckboxIndicator } from '@/components/ui/checkbox';
import type { ComponentProps } from 'react';

type Props = ComponentProps<typeof CheckboxIndicator>;

// 背景を塗ったチェックボックスの枠（中身は CheckboxIcon をそのまま渡す）。
// gluestack の CheckboxIndicator はライトで背景が透明なため、色付きの画面背景に溶け込む。カードと同じ背景にして浮かせる
// （チェック時の bg-primary と、ダークの dark:bg-input/30 は CheckboxIndicator 側がそのまま効く）
export function FilledCheckboxIndicator({ className, ...props }: Props) {
  return <CheckboxIndicator className={`bg-card ${className ?? ''}`} {...props} />;
}
