import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';

// TODO: 仮実装。タブの動作確認用に文言のみ表示する。
// 本実装ではお悩み投稿の一覧と「お悩み投稿」ボタンを表示し、応募ボタンは占い師登録済みのユーザーにだけ出す
export function Concerns() {
  return (
    <VStack className="flex-1 justify-center bg-background p-6">
      <Text size="md" className="text-center">
        お悩み一覧（準備中）
      </Text>
    </VStack>
  );
}
