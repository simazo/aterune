import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';

// TODO: 仮実装。タブの動作確認用に文言のみ表示する。
// 本実装では申込み（承認待ち）から完了までのセッションを一覧にし、相談者としてのものと占い師としてのものを区別して表示する
export function Messages() {
  return (
    <VStack className="flex-1 justify-center bg-background p-6">
      <Text size="md" className="text-center">
        やり取り（準備中）
      </Text>
    </VStack>
  );
}
