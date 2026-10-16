import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';

// TODO: 仮実装。タブの動作確認用に文言のみ表示する。
// 本実装ではセッション中のやり取りの一覧を表示する
export function Messages() {
  return (
    <VStack className="flex-1 justify-center bg-background p-6">
      <Text size="md" className="text-center">
        メッセージ（準備中）
      </Text>
    </VStack>
  );
}
