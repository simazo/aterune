import { signOut } from '@/api/auth';
import { Button, ButtonSpinner, ButtonText } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { useAuth } from '@/hooks/use-auth';
import { useState } from 'react';

// TODO: 仮実装。ログイン中であることの確認とログアウトのみ。
// 本実装ではプロフィール、お悩み投稿の一覧などを表示する
export function MyPage() {
  const { session } = useAuth();
  const [loading, setLoading] = useState(false);

  async function handleSignOut() {
    setLoading(true);
    await signOut();
    setLoading(false);
  }

  return (
    <VStack className="flex-1 justify-center bg-background p-6" space="md">
      <Text size="md">ログイン中: {session?.user.email}</Text>
      <Button variant="secondary" onPress={handleSignOut} isDisabled={loading}>
        {loading ? <ButtonSpinner /> : <ButtonText>ログアウト</ButtonText>}
      </Button>
    </VStack>
  );
}
