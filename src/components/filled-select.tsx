import { ChevronDownIcon } from '@/components/ui/icon';
import {
  Select,
  SelectBackdrop,
  SelectContent,
  SelectDragIndicator,
  SelectDragIndicatorWrapper,
  SelectIcon,
  SelectInput,
  SelectItem,
  SelectPortal,
  SelectScrollView,
  SelectTrigger,
} from '@/components/ui/select';

export type SelectOption = {
  label: string;
  value: string;
};

type Props = {
  options: SelectOption[];
  // 未選択は null
  value: string | null;
  onValueChange: (value: string) => void;
  placeholder: string;
  className?: string;
};

// 背景を塗ったセレクトボックス。選択肢は下から出る一覧で選び、多いとき（年など）は一覧の中をスクロールできる。
// gluestack の SelectTrigger はライトで背景が透明なため、色付きの画面背景に溶け込む。カードと同じ背景にして浮かせる。
// gluestack の Select は、表示する文字（ラベル）を項目をタップしたときにしか更新しない。
// そのため最初の表示は initialLabel で渡し、value を null に戻すとラベルも消える（initialLabel も空になるため）。
// 外から別の値へ切り替えたときは表示が追従しないので、その使い方はしない
export function FilledSelect({ options, value, onValueChange, placeholder, className }: Props) {
  const selectedLabel = options.find((option) => option.value === value)?.label;

  return (
    <Select
      selectedValue={value}
      initialLabel={selectedLabel}
      onValueChange={onValueChange}
      className={className}
    >
      <SelectTrigger className="bg-card">
        <SelectInput placeholder={placeholder} className="flex-1" />
        <SelectIcon as={ChevronDownIcon} className="mr-3" />
      </SelectTrigger>
      <SelectPortal>
        <SelectBackdrop />
        <SelectContent className="max-h-[70%]">
          <SelectDragIndicatorWrapper>
            <SelectDragIndicator />
          </SelectDragIndicatorWrapper>
          <SelectScrollView>
            {options.map((option) => (
              <SelectItem key={option.value} label={option.label} value={option.value} />
            ))}
          </SelectScrollView>
        </SelectContent>
      </SelectPortal>
    </Select>
  );
}
