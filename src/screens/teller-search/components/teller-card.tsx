import { Avatar, AvatarFallbackText, AvatarImage } from '@/components/ui/avatar';
import { Badge, BadgeText } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Heading } from '@/components/ui/heading';
import { HStack } from '@/components/ui/hstack';
import { Pressable } from '@/components/ui/pressable';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import type { TellerSearchResult } from '@/types';
import { getAccentClass, isNewcomer } from '@/utils/teller';
import { useRouter } from 'expo-router';

// 自己PRはカードでは冒頭だけ見せる（約3行分）。
// 行数で切る numberOfLines / line-clamp は、Web 版の Text（span）に numberOfLines がそのまま渡って警告になるため、文字数で切る
const SELF_PR_MAX_LENGTH = 60;

function truncate(text: string, maxLength: number) {
  return text.length > maxLength ? `${text.slice(0, maxLength)}…` : text;
}

type Props = {
  teller: TellerSearchResult;
};

// タップすると占い師詳細画面へ移る
export function TellerCard({ teller }: Props) {
  const router = useRouter();

  function handlePress() {
    router.push({ pathname: '/tellers/[id]', params: { id: teller.teller_id } });
  }

  return (
    // 2列のとき、同じ行のカードの高さを揃えるため、Pressable・Card とも flex-1 で枠いっぱいに広げる。
    // 押している間は少し薄くして、押せることが分かるようにする
    <Pressable
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={`${teller.display_name}の詳細を見る`}
      className="flex-1 data-[active=true]:opacity-80"
    >
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
                  <Text size="sm" className="text-amber-500 dark:text-amber-400">
                    ★
                  </Text>{' '}
                  {teller.average_rating.toFixed(1)}
                </>
              )}
            </Text>
          </HStack>
        </VStack>
      </Card>
    </Pressable>
  );
}
