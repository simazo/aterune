import { SelectableButton } from '@/components/selectable-button';
import {
  FormControl,
  FormControlError,
  FormControlErrorText,
  FormControlLabel,
  FormControlLabelText,
} from '@/components/ui/form-control';
import { HStack } from '@/components/ui/hstack';
import type { Tag } from '@/types';

type Props = {
  label: string;
  tags: Pick<Tag, 'id' | 'name'>[];
  selectedIds: string[];
  onChange: (selectedIds: string[]) => void;
  errorMessage?: string;
};

// 1種類分のタグを複数選ぶ。選び漏れに気づきやすいよう、閉じずに全件を並べる
export function TagSelectSection({ label, tags, selectedIds, onChange, errorMessage }: Props) {
  function handleToggle(tagId: string) {
    onChange(
      selectedIds.includes(tagId)
        ? selectedIds.filter((id) => id !== tagId)
        : [...selectedIds, tagId]
    );
  }

  return (
    <FormControl isInvalid={!!errorMessage}>
      <FormControlLabel>
        <FormControlLabelText>{label}</FormControlLabelText>
      </FormControlLabel>
      <HStack className="flex-wrap" space="xs">
        {tags.map((tag) => (
          <SelectableButton
            key={tag.id}
            label={tag.name}
            isSelected={selectedIds.includes(tag.id)}
            onPress={() => handleToggle(tag.id)}
          />
        ))}
      </HStack>
      <FormControlError>
        <FormControlErrorText>{errorMessage}</FormControlErrorText>
      </FormControlError>
    </FormControl>
  );
}
