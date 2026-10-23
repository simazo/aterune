import { Badge, BadgeText } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { HStack } from '@/components/ui/hstack';
import { Pressable } from '@/components/ui/pressable';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import type { ConsultationPostListItem } from '@/types';
import { useRouter } from 'expo-router';

// お悩みはカードでは冒頭だけ見せる（約2行分）。
// 行数で切る numberOfLines は Web 版の Text で警告になるため、文字数で切る（session-card と同じ理由）
const CONCERN_MAX_LENGTH = 60;

function truncate(text: string, maxLength: number) {
  return text.length > maxLength ? `${text.slice(0, maxLength)}…` : text;
}

function formatDate(value: string) {
  const date = new Date(value);
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

type Props = {
  post: ConsultationPostListItem;
};

// お悩み一覧の1件。投稿者は匿名なので名前は出さない。タップすると投稿の詳細画面へ移る
export function ConcernCard({ post }: Props) {
  const router = useRouter();

  function handlePress() {
    router.push({ pathname: '/concerns/[id]', params: { id: post.id } });
  }

  return (
    // 押している間は少し薄くして、押せることが分かるようにする
    <Pressable
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={`${post.concern_tag_name}のお悩みを見る`}
      className="data-[active=true]:opacity-80"
    >
      <Card size="sm">
        <VStack space="xs">
          <HStack className="items-center justify-between" space="sm">
            <HStack className="flex-1 flex-wrap" space="xs">
              <Badge variant="secondary">
                <BadgeText>{post.concern_tag_name}</BadgeText>
              </Badge>
              {post.status === 'in_progress' && (
                <Badge variant="outline">
                  <BadgeText>対応中</BadgeText>
                </Badge>
              )}
              {post.is_mine && (
                <Badge variant="outline">
                  <BadgeText>あなたの投稿</BadgeText>
                </Badge>
              )}
              {post.has_applied && (
                <Badge variant="outline">
                  <BadgeText>応募済み</BadgeText>
                </Badge>
              )}
            </HStack>
            <Text size="xs" className="text-muted-foreground">
              {formatDate(post.created_at)}
            </Text>
          </HStack>

          <Text size="sm">{truncate(post.concern, CONCERN_MAX_LENGTH)}</Text>
        </VStack>
      </Card>
    </Pressable>
  );
}
