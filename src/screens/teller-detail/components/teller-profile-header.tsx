import { getAvatarUrl } from '@/api/avatars';
import { Avatar, AvatarFallbackText, AvatarImage } from '@/components/ui/avatar';
import { Badge, BadgeText } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Heading } from '@/components/ui/heading';
import { HStack } from '@/components/ui/hstack';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import type { TellerDetail } from '@/types';
import { getAccentClass, isNewcomer } from '@/utils/teller';

// 例：2026年10月
function formatYearMonth(isoString: string) {
  const date = new Date(isoString);
  return `${date.getFullYear()}年${date.getMonth() + 1}月`;
}

type Props = {
  teller: TellerDetail;
};

// 詳細画面の上部。帯・アバター・名前・修行期間・活動を始めた月・バッジと、評価・セッション数・お気に入りの人数の数字の行
export function TellerProfileHeader({ teller }: Props) {
  return (
    <Card className="gap-0 overflow-hidden p-0">
      <VStack className={`h-20 ${getAccentClass(teller.teller_id)}`} />

      <VStack className="px-4 pb-4" space="sm">
        <Avatar size="lg" className="-mt-8 border-4 border-card">
          <AvatarFallbackText>{teller.display_name}</AvatarFallbackText>
          {teller.avatar_path && <AvatarImage source={{ uri: getAvatarUrl(teller.avatar_path) }} />}
        </Avatar>

        <VStack>
          <Heading size="xl">{teller.display_name}</Heading>
          {/* 活動を始めた月は、修行期間が未入力でも右端に出す */}
          <HStack className="justify-between" space="sm">
            <Text size="sm" className="text-muted-foreground">
              {teller.training_period && `修行 ${teller.training_period}`}
            </Text>
            <Text size="sm" className="text-muted-foreground">
              {formatYearMonth(teller.created_at)}から活動
            </Text>
          </HStack>
        </VStack>

        {(!teller.is_accepting || isNewcomer(teller.session_count)) && (
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
          </HStack>
        )}

        <HStack className="mt-2 border-t border-border pt-3">
          <VStack className="flex-1 items-center">
            {teller.average_rating === null ? (
              <Text size="lg" className="text-muted-foreground">
                評価なし
              </Text>
            ) : (
              <Text size="lg" className="font-bold">
                <Text size="lg" className="text-amber-500 dark:text-amber-400">
                  ★
                </Text>{' '}
                {teller.average_rating.toFixed(1)}
              </Text>
            )}
            <Text size="xs" className="text-muted-foreground">
              {teller.review_count}件の評価
            </Text>
          </VStack>
          <VStack className="flex-1 items-center">
            <Text size="lg" className="font-bold">
              {teller.session_count}回
            </Text>
            <Text size="xs" className="text-muted-foreground">
              セッション
            </Text>
          </VStack>
          {/* 0人のときは出さない（まだ登録されていない新人が見劣りしないように） */}
          {teller.favorite_count > 0 && (
            <VStack className="flex-1 items-center">
              <Text size="lg" className="font-bold">
                {teller.favorite_count}人
              </Text>
              <Text size="xs" className="text-muted-foreground">
                お気に入り
              </Text>
            </VStack>
          )}
        </HStack>
      </VStack>
    </Card>
  );
}
