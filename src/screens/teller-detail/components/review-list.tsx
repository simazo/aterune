import { Button, ButtonText } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Heading } from '@/components/ui/heading';
import { HStack } from '@/components/ui/hstack';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import type { TellerReview } from '@/types';

const MAX_RATING = 5;

// 例：2026/10/12
function formatDate(isoString: string) {
  const date = new Date(isoString);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}/${month}/${day}`;
}

type Props = {
  reviews: TellerReview[];
  // 占い師のレビューの総数。reviews は新しい順の先頭の数件だけなので、残りがあるかどうかの判定に使う
  reviewCount: number;
};

// レビュー一覧。レビューした相談者は表示しない（匿名）
export function ReviewList({ reviews, reviewCount }: Props) {
  return (
    <Card>
      <VStack space="md">
        <Heading size="md">レビュー（{reviewCount}件）</Heading>

        {reviews.length === 0 ? (
          <Text size="sm" className="text-muted-foreground">
            まだレビューはありません
          </Text>
        ) : (
          reviews.map((review, index) => (
            <VStack
              key={review.id}
              space="xs"
              className={index === 0 ? undefined : 'border-t border-border pt-3'}
            >
              <HStack className="items-center justify-between">
                <Text size="sm">
                  <Text size="sm" className="text-amber-500 dark:text-amber-400">
                    {'★'.repeat(review.rating)}
                  </Text>
                  <Text size="sm" className="text-muted-foreground">
                    {'★'.repeat(MAX_RATING - review.rating)}
                  </Text>
                </Text>
                <Text size="xs" className="text-muted-foreground">
                  {formatDate(review.created_at)}
                </Text>
              </HStack>
              {review.comment && <Text size="sm">{review.comment}</Text>}
            </VStack>
          ))
        )}

        {reviewCount > reviews.length && (
          // TODO: 仮実装。全件表示の画面（または続きの読み込み）は未作成のため押せない。
          // 作成時に遷移（または追加の読み込み）を付ける
          <Button variant="link" size="sm" isDisabled>
            <ButtonText>すべてのレビューを見る</ButtonText>
          </Button>
        )}
      </VStack>
    </Card>
  );
}
