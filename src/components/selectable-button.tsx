import { Button, ButtonText } from '@/components/ui/button';

type Props = {
  label: string;
  isSelected: boolean;
  onPress: () => void;
};

// 押すと選択中に切り替わるボタン（タグの絞り込み、並び順など）。
// 未選択の outline は背景が画面の背景と同じ色で埋もれるため、カードと同じ背景にして浮かせる
export function SelectableButton({ label, isSelected, onPress }: Props) {
  return (
    <Button
      size="sm"
      variant={isSelected ? 'default' : 'outline'}
      className={isSelected ? undefined : 'bg-card'}
      onPress={onPress}
    >
      <ButtonText>{label}</ButtonText>
    </Button>
  );
}
