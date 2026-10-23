import { signUpWithEmail } from '@/api/auth';
import { FormTextField } from '@/components/form-text-field';
import { Button, ButtonSpinner, ButtonText } from '@/components/ui/button';
import { Heading } from '@/components/ui/heading';
import { Link, LinkText } from '@/components/ui/link';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { useErrorToast } from '@/hooks/use-error-toast';
import { getAuthErrorMessage } from '@/utils/auth-error';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { signupSchema, type SignupFormValues } from './schema';

export function Signup() {
  const router = useRouter();
  const showError = useErrorToast();
  const [isSigningUp, setIsSigningUp] = useState(false);
  const [signUpEmailSent, setSignUpEmailSent] = useState(false);
  const { control, handleSubmit } = useForm<SignupFormValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: { displayName: '', email: '', password: '' },
  });

  async function onSubmit({ displayName, email, password }: SignupFormValues) {
    setIsSigningUp(true);

    const { error } = await signUpWithEmail(email, password, displayName);

    if (error) {
      showError(getAuthErrorMessage(error));
    } else {
      // Confirm email必須のため、この時点ではセッションはまだ確立しない
      setSignUpEmailSent(true);
    }
    setIsSigningUp(false);
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

      <FormTextField control={control} name="displayName" placeholder="表示名" />

      <FormTextField
        control={control}
        name="email"
        placeholder="メールアドレス"
        autoCapitalize="none"
        keyboardType="email-address"
      />

      <FormTextField control={control} name="password" placeholder="パスワード" secureTextEntry />

      <Button onPress={handleSubmit(onSubmit)} isDisabled={isSigningUp} className="mt-2">
        {isSigningUp ? <ButtonSpinner /> : <ButtonText>新規登録</ButtonText>}
      </Button>

      <Link onPress={() => router.replace('/login')}>
        <LinkText className="mt-2 text-center" size="sm">
          ログインはこちら
        </LinkText>
      </Link>
    </VStack>
  );
}
