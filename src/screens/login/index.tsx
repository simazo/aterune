import { signInWithEmail } from '@/api/auth';
import { savePushTokenForCurrentUser } from '@/api/push-tokens';
import { FormTextField } from '@/components/form-text-field';
import { Button, ButtonSpinner, ButtonText } from '@/components/ui/button';
import { Heading } from '@/components/ui/heading';
import { Link, LinkText } from '@/components/ui/link';
import { VStack } from '@/components/ui/vstack';
import { useErrorToast } from '@/hooks/use-error-toast';
import { getAuthErrorMessage } from '@/utils/auth-error';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { loginSchema, type LoginFormValues } from './schema';

export function Login() {
  const router = useRouter();
  const showError = useErrorToast();
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const { control, handleSubmit } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  async function onSubmit({ email, password }: LoginFormValues) {
    setIsLoggingIn(true);

    const { error } = await signInWithEmail(email, password);

    if (error) {
      showError(getAuthErrorMessage(error));
    } else {
      // ログイン成功 → push token登録
      await savePushTokenForCurrentUser();
    }
    setIsLoggingIn(false);
  }

  return (
    <VStack className="flex-1 justify-center bg-background p-6" space="md">
      <Heading size="xl" className="mb-3">
        ログイン
      </Heading>

      <FormTextField
        control={control}
        name="email"
        placeholder="メールアドレス"
        autoCapitalize="none"
        keyboardType="email-address"
      />

      <FormTextField control={control} name="password" placeholder="パスワード" secureTextEntry />

      <Button onPress={handleSubmit(onSubmit)} isDisabled={isLoggingIn} className="mt-2">
        {isLoggingIn ? <ButtonSpinner /> : <ButtonText>ログイン</ButtonText>}
      </Button>

      <Link onPress={() => router.push('/forgot-password')}>
        <LinkText className="mt-2 text-center" size="sm">
          パスワードをお忘れの方
        </LinkText>
      </Link>

      <Link onPress={() => router.push('/signup')}>
        <LinkText className="mt-2 text-center" size="sm">
          アカウントをお持ちでない方はこちら
        </LinkText>
      </Link>
    </VStack>
  );
}
