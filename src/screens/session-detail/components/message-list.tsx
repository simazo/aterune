import { HStack } from '@/components/ui/hstack';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import type { Message } from '@/types';

type Props = {
  messages: Pick<Message, 'id' | 'sender_id' | 'content' | 'created_at'>[];
  userId: string;
  partnerName: string;
};

function formatDateTime(value: string) {
  const date = new Date(value);
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${date.getMonth() + 1}/${date.getDate()} ${date.getHours()}:${minutes}`;
}

// セッションのメッセージを古い順に並べる。自分のものは右、相手のものは左に出す
export function MessageList({ messages, userId, partnerName }: Props) {
  if (messages.length === 0) {
    return (
      <Text size="sm" className="text-center text-muted-foreground">
        まだメッセージはありません
      </Text>
    );
  }

  return (
    <VStack space="md">
      {messages.map((message) => {
        const isMine = message.sender_id === userId;
        return (
          <VStack key={message.id} space="xs" className={isMine ? 'items-end' : 'items-start'}>
            <VStack
              className={`max-w-[85%] rounded-2xl px-4 py-2 ${
                isMine ? 'rounded-br-sm bg-primary' : 'rounded-bl-sm border border-border bg-card'
              }`}
            >
              <Text size="md" className={isMine ? 'text-primary-foreground' : undefined}>
                {message.content}
              </Text>
            </VStack>
            <HStack space="xs">
              {!isMine && (
                <Text size="xs" className="text-muted-foreground">
                  {partnerName}
                </Text>
              )}
              <Text size="xs" className="text-muted-foreground">
                {formatDateTime(message.created_at)}
              </Text>
            </HStack>
          </VStack>
        );
      })}
    </VStack>
  );
}
