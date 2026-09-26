import { Button, ButtonSpinner, ButtonText } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { useAuth } from '@/hooks/use-auth';
import { signOut } from '@/lib/auth';
import { useState } from 'react';

// TODO: 仮実装。ログイン中であることの確認用の簡易画面。
// 本実装ではフロントエンド設計方針に沿って、screens/配下の実際のホーム画面に置き換える。
export default function AppHomeScreen() {
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
