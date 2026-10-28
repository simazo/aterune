import { sendPasswordResetEmail } from '@/api/auth';
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
import { forgotPasswordSchema, type ForgotPasswordFormValues } from './schema';

export function ForgotPassword() {
  const router = useRouter();
  const showError = useErrorToast();
  const [isSending, setIsSending] = useState(false);
  const [isEmailSent, setIsEmailSent] = useState(false);
  const { control, handleSubmit } = useForm<ForgotPasswordFormValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: '' },
  });

  async function onSubmit({ email }: ForgotPasswordFormValues) {
    setIsSending(true);

    const { error } = await sendPasswordResetEmail(email);

    if (error) {
      // 送信回数の上限（429）や通信エラー。未登録のメールアドレスではエラーにならない
      showError(getAuthErrorMessage(error));
    } else {
      setIsEmailSent(true);
    }
    setIsSending(false);
  }

  if (isEmailSent) {
    // 登録の有無を外から調べられないよう、登録済みかどうかに関係なく同じ文言を出す
    return (
      <VStack className="flex-1 justify-center bg-background p-6" space="md">
        <Text size="md" className="text-center">
          入力したメールアドレスが登録されている場合は、{'\n'}
          パスワード再設定用のメールを送信しました。{'\n'}
          メール内のリンクをタップして、新しいパスワードを設定してください。
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
        パスワードの再設定
      </Heading>

      <Text size="md">
        登録したメールアドレスを入力してください。パスワード再設定用のリンクをお送りします。
      </Text>

      <FormTextField
        control={control}
        name="email"
        placeholder="メールアドレス"
        autoCapitalize="none"
        keyboardType="email-address"
      />

      <Button onPress={handleSubmit(onSubmit)} isDisabled={isSending} className="mt-2">
        {isSending ? <ButtonSpinner /> : <ButtonText>送信する</ButtonText>}
      </Button>

      <Link onPress={() => router.replace('/login')}>
        <LinkText className="mt-2 text-center" size="sm">
          ログイン画面に戻る
        </LinkText>
      </Link>
    </VStack>
  );
}
