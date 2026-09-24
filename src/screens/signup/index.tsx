import { Button, ButtonSpinner, ButtonText } from '@/components/ui/button';
import { Heading } from '@/components/ui/heading';
import { Input, InputField } from '@/components/ui/input';
import { Link, LinkText } from '@/components/ui/link';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { useErrorToast } from '@/hooks/use-error-toast';
import { signUpWithEmail } from '@/lib/auth';
import { useRouter } from 'expo-router';
import { useState } from 'react';

export function Signup() {
  const router = useRouter();
  const showError = useErrorToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);
  const [signUpEmailSent, setSignUpEmailSent] = useState(false);

  async function handleSignUp() {
    setLoading(true);

    if (!displayName.trim()) {
      showError('表示名を入力してください');
      setLoading(false);
      return;
    }

    const { error } = await signUpWithEmail(email, password, displayName.trim());

    if (error) {
      showError(error.message);
    } else {
      // Confirm email必須のため、この時点ではセッションはまだ確立しない
      setSignUpEmailSent(true);
    }
    setLoading(false);
  }

  if (signUpEmailSent) {
    return (
      <VStack className="flex-1 justify-center bg-background p-6" space="md">
        <Text size="md" className="text-center">
          確認メールを送信しました。{'\n'}
          メール内のリンクをタップして登録を完了してください。
        </Text>
        <Button variant="secondary" onPress={() => router.replace('/login')}>
          <ButtonText>ログイン画面に戻る</ButtonText>
        </Button>
      </VStack>
    );
  }

  return (
    <VStack className="flex-1 justify-center bg-background p-6" space="md">
      <Heading size="xl" className="mb-3">
        新規登録
      </Heading>

      <Input>
        <InputField placeholder="表示名" value={displayName} onChangeText={setDisplayName} />
      </Input>
      <Input>
        <InputField
          placeholder="メールアドレス"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />
      </Input>
      <Input>
        <InputField
          placeholder="パスワード"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />
      </Input>

      <Button onPress={handleSignUp} isDisabled={loading} className="mt-2">
        {loading ? <ButtonSpinner /> : <ButtonText>新規登録</ButtonText>}
      </Button>

      <Link onPress={() => router.replace('/login')}>
        <LinkText className="mt-2 text-center" size="sm">
          ログインはこちら
        </LinkText>
      </Link>
    </VStack>
  );
}
