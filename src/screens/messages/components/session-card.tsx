import { Badge, BadgeText } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Heading } from '@/components/ui/heading';
import { HStack } from '@/components/ui/hstack';
import { Pressable } from '@/components/ui/pressable';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import type { SessionListItem } from '@/types';
import { formatRemaining, getEndedLabel } from '@/utils/session-display';
import { useRouter } from 'expo-router';

// お悩みはカードでは冒頭だけ見せる（約1行分）。
// 行数で切る numberOfLines は Web 版の Text で警告になるため、文字数で切る（teller-card と同じ理由）
const CONCERN_MAX_LENGTH = 30;

function truncate(text: string, maxLength: number) {
  return text.length > maxLength ? `${text.slice(0, maxLength)}…` : text;
}

function formatDate(value: string) {
  const date = new Date(value);
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

type Props = {
  session: SessionListItem;
  // 承認待ちなら残り時間、終了なら結果を出す。進行中は更新日だけ
  kind: 'pending' | 'active' | 'ended';
  now: Date;
};

// タップするとセッション詳細画面へ移る
export function SessionCard({ session, kind, now }: Props) {
  const router = useRouter();
  const partnerName = session.partner_name ?? '退会したユーザー';

  function handlePress() {
    router.push({ pathname: '/sessions/[id]', params: { id: session.id } });
  }

  return (
    // 押している間は少し薄くして、押せることが分かるようにする
    <Pressable
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={`${partnerName}とのやり取りを見る`}
      className="data-[active=true]:opacity-80"
    >
      <Card size="sm">
        <VStack space="xs">
          <HStack className="items-center justify-between" space="sm">
            <Heading size="sm" className="flex-1">
              {partnerName}
            </Heading>
            {kind === 'pending' ? (
              <Text size="xs" className="text-primary">
                {formatRemaining(session.expires_at, now)}
              </Text>
            ) : (
              <Text size="xs" className="text-muted-foreground">
                {formatDate(session.updated_at)}
              </Text>
            )}
          </HStack>

          <Text size="sm" className="text-muted-foreground">
            {truncate(session.concern, CONCERN_MAX_LENGTH)}
          </Text>

          {kind === 'ended' && (
            <HStack>
              <Badge variant="outline">
                <BadgeText>{getEndedLabel(session.status)}</BadgeText>
              </Badge>
            </HStack>
          )}
        </VStack>
      </Card>
    </Pressable>
  );
}
