import { Button, ButtonText } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Heading } from '@/components/ui/heading';
import { HStack } from '@/components/ui/hstack';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import type { Review } from '@/types';
import { formatReviewDeadline } from '@/utils/review';

const MAX_RATING = 5;

// 例：2026/10/12
function formatDate(isoString: string) {
  const date = new Date(isoString);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}/${month}/${day}`;
}

type Props = {
  // 読めなかったら undefined、まだ無ければ null
  review: Pick<Review, 'rating' | 'comment' | 'created_at'> | null | undefined;
  isTeller: boolean;
  canWrite: boolean;
  completedAt: string | null;
  onWrite: () => void;
};

// 完了したセッションのレビュー。相談者・占い師の両方に、付いたレビューを見せる。
// まだ無ければ、書ける相談者には「レビューを書く」を出す
export function ReviewCard({ review, isTeller, canWrite, completedAt, onWrite }: Props) {
  return (
    <Card>
      <VStack space="sm">
        <Heading size="md">{isTeller ? '相談者からのレビュー' : 'あなたのレビュー'}</Heading>

        {review === undefined ? (
          <Text size="sm" className="text-muted-foreground">
            レビューを表示できませんでした
          </Text>
        ) : review ? (
          <VStack space="xs">
            <HStack className="items-center justify-between">
              <Text size="md">
                <Text size="md" className="text-amber-500 dark:text-amber-400">
                  {'★'.repeat(review.rating)}
                </Text>
                <Text size="md" className="text-muted-foreground">
                  {'★'.repeat(MAX_RATING - review.rating)}
                </Text>
              </Text>
              <Text size="xs" className="text-muted-foreground">
                {formatDate(review.created_at)}
              </Text>
            </HStack>
            {review.comment && <Text size="md">{review.comment}</Text>}
          </VStack>
        ) : canWrite && completedAt ? (
          <VStack space="sm">
            <Text size="sm" className="text-muted-foreground">
              {formatReviewDeadline(completedAt)}に書けます。占い師の励みになります。
            </Text>
            <Button className="self-start" onPress={onWrite}>
              <ButtonText>レビューを書く</ButtonText>
            </Button>
          </VStack>
        ) : (
          <Text size="sm" className="text-muted-foreground">
            {isTeller ? 'まだレビューはありません' : 'レビューを書ける期間は終わりました'}
          </Text>
        )}
      </VStack>
    </Card>
  );
}
