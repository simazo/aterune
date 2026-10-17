import { Avatar, AvatarFallbackText, AvatarImage } from '@/components/ui/avatar';
import { Badge, BadgeText } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Heading } from '@/components/ui/heading';
import { HStack } from '@/components/ui/hstack';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import type { TellerSearchResult } from '@/types';
import { isNewcomer } from '@/utils/teller';

// カード上部の帯の色。占い師ごとに固定の1色を選ぶ（Tailwind が拾えるようクラス名は省略せずに書く）
const ACCENT_CLASSES = ['bg-violet-200', 'bg-pink-200', 'bg-emerald-200', 'bg-amber-200', 'bg-sky-200'];

function getAccentClass(tellerId: string) {
  let sum = 0;
  for (const char of tellerId) {
    sum += char.charCodeAt(0);
  }
  return ACCENT_CLASSES[sum % ACCENT_CLASSES.length];
}

// 自己PRはカードでは冒頭だけ見せる（約3行分）。
// 行数で切る numberOfLines / line-clamp は、Web 版の Text（span）に numberOfLines がそのまま渡って警告になるため、文字数で切る
const SELF_PR_MAX_LENGTH = 60;

function truncate(text: string, maxLength: number) {
  return text.length > maxLength ? `${text.slice(0, maxLength)}…` : text;
}

type Props = {
  teller: TellerSearchResult;
};

// TODO: 仮実装。タップしても何も起きない。占い師詳細画面を作ったら Pressable で包んで遷移させる
export function TellerCard({ teller }: Props) {
  return (
    // 2列のとき、同じ行のカードの高さを揃えるため flex-1 で枠いっぱいに広げる
    <Card size="sm" className="flex-1 gap-0 overflow-hidden p-0">
      <VStack className={`h-14 ${getAccentClass(teller.teller_id)}`} />

      <VStack className="px-4 pb-4" space="sm">
        <Avatar size="lg" className="-mt-8 border-4 border-card">
          <AvatarFallbackText>{teller.display_name}</AvatarFallbackText>
          {teller.avatar_url && <AvatarImage source={{ uri: teller.avatar_url }} />}
        </Avatar>

        <VStack>
          <Heading size="md">{teller.display_name}</Heading>
          {teller.training_period && (
            <Text size="sm" className="text-muted-foreground">
              修行 {teller.training_period}
            </Text>
          )}
        </VStack>

        {teller.self_pr && (
          <Text size="sm">
            {truncate(teller.self_pr, SELF_PR_MAX_LENGTH)}
          </Text>
        )}

        <HStack className="flex-wrap" space="xs">
          {!teller.is_accepting && (
            <Badge variant="destructive">
              <BadgeText>受付停止中</BadgeText>
            </Badge>
          )}
          {isNewcomer(teller.session_count) && (
            <Badge variant="default">
              <BadgeText>新人</BadgeText>
            </Badge>
          )}
          {teller.tags.map((tag) => (
            <Badge key={tag.slug} variant={tag.category === 'divination' ? 'secondary' : 'outline'}>
              <BadgeText>{tag.name}</BadgeText>
            </Badge>
          ))}
        </HStack>

        <HStack className="items-center justify-between">
          <Text size="sm" className="text-muted-foreground">
            セッション {teller.session_count}回
          </Text>
          <Text size="sm">
            {teller.average_rating === null ? (
              <Text size="sm" className="text-muted-foreground">
                評価なし
              </Text>
            ) : (
              <>
                <Text size="sm" className="text-amber-400">
                  ★
                </Text>{' '}
                {teller.average_rating.toFixed(1)}
              </>
            )}
          </Text>
        </HStack>
      </VStack>
    </Card>
  );
}
