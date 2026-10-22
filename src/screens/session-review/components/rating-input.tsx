import { HStack } from '@/components/ui/hstack';
import { Icon, StarIcon } from '@/components/ui/icon';
import { Pressable } from '@/components/ui/pressable';

const RATINGS = [1, 2, 3, 4, 5];

type Props = {
  // 選んだ星の数（未選択は 0）
  value: number;
  onChange: (rating: number) => void;
};

// 評価（星5つ）の入力。押した星までを塗る
export function RatingInput({ value, onChange }: Props) {
  return (
    <HStack space="sm">
      {RATINGS.map((rating) => (
        <Pressable
          key={rating}
          className="p-1"
          onPress={() => onChange(rating)}
          accessibilityRole="button"
          accessibilityLabel={`星${rating}つ`}
          accessibilityState={{ selected: rating === value }}
        >
          <Icon
            as={StarIcon}
            className={
              rating <= value
                ? 'h-9 w-9 fill-amber-500 text-amber-500 dark:fill-amber-400 dark:text-amber-400'
                : 'h-9 w-9 text-muted-foreground'
            }
          />
        </Pressable>
      ))}
    </HStack>
  );
}
