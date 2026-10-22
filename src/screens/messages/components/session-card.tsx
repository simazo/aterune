import { Badge, BadgeText } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Heading } from '@/components/ui/heading';
import { HStack } from '@/components/ui/hstack';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import type { SessionListItem } from '@/types';

// お悩みはカードでは冒頭だけ見せる（約1行分）。
// 行数で切る numberOfLines は Web 版の Text で警告になるため、文字数で切る（teller-card と同じ理由）
const CONCERN_MAX_LENGTH = 30;

const HOUR_MS = 60 * 60 * 1000;

function truncate(text: string, maxLength: number) {
  return text.length > maxLength ? `${text.slice(0, maxLength)}…` : text;
}

// 承認待ちの残り時間（一覧を読み込んだ時点）
function formatRemaining(expiresAt: string, now: Date) {
  const hours = Math.floor((new Date(expiresAt).getTime() - now.getTime()) / HOUR_MS);
  return hours < 1 ? '残り1時間未満' : `残り${hours}時間`;
}

function formatDate(value: string) {
  const date = new Date(value);
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

// 終了したセッションの結果の表示名。
// 期限切れの pending（DB の定期処理が未実装で expired に変わっていないもの）は「終了」セクションにだけ来るので、期限切れとして出す
function getEndedLabel(status: SessionListItem['status']) {
  switch (status) {
    case 'completed':
    case 'auto_completed':
      return '完了';
    case 'rejected':
      return 'お見送り';
    default:
      return '期限切れ';
  }
}

type Props = {
  session: SessionListItem;
  // 承認待ちなら残り時間、終了なら結果を出す。進行中は更新日だけ
  kind: 'pending' | 'active' | 'ended';
  now: Date;
};

// TODO: タップでセッション詳細（/sessions/[id]）へ移る処理は、詳細画面を作るときに付ける
export function SessionCard({ session, kind, now }: Props) {
  return (
    <Card size="sm">
      <VStack space="xs">
        <HStack className="items-center justify-between" space="sm">
          <Heading size="sm" className="flex-1">
            {session.partner_name ?? '退会したユーザー'}
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
  );
}
