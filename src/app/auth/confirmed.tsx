import { Button, ButtonText } from '@/components/ui/button';
import { Heading } from '@/components/ui/heading';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { useRouter } from 'expo-router';

export default function AuthConfirmedScreen() {
  const router = useRouter();

  return (
    <VStack className="flex-1 justify-center bg-background p-6" space="md">
      <Heading size="xl" className="mb-3 text-center">
        メール確認が完了しました
      </Heading>
      <Text size="md" className="text-center">
        ログインしてアテルネをご利用ください。
      </Text>
      <Button onPress={() => router.replace('/login')} className="mt-2">
        <ButtonText>ログイン画面へ</ButtonText>
      </Button>
    </VStack>
  );
}
