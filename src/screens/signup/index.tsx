import { signUpWithEmail } from '@/api/auth';
import { FilledInput } from '@/components/filled-input';
import { Button, ButtonSpinner, ButtonText } from '@/components/ui/button';
import { FormControl, FormControlError, FormControlErrorText } from '@/components/ui/form-control';
import { Heading } from '@/components/ui/heading';
import { InputField } from '@/components/ui/input';
import { Link, LinkText } from '@/components/ui/link';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { useErrorToast } from '@/hooks/use-error-toast';
import { getAuthErrorMessage } from '@/utils/auth-error';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { signupSchema, type SignupFormValues } from './schema';

export function Signup() {
  const router = useRouter();
  const showError = useErrorToast();
  const [loading, setLoading] = useState(false);
  const [signUpEmailSent, setSignUpEmailSent] = useState(false);
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<SignupFormValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: { displayName: '', email: '', password: '' },
  });

  async function onSubmit({ displayName, email, password }: SignupFormValues) {
    setLoading(true);

    const { error } = await signUpWithEmail(email, password, displayName.trim());

    if (error) {
      showError(getAuthErrorMessage(error));
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

      <Controller
        control={control}
        name="displayName"
        render={({ field: { value, onChange, onBlur } }) => (
          <FormControl isInvalid={!!errors.displayName}>
            <FilledInput>
              <InputField
                placeholder="表示名"
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
              />
            </FilledInput>
            <FormControlError>
              <FormControlErrorText>{errors.displayName?.message}</FormControlErrorText>
            </FormControlError>
          </FormControl>
        )}
      />

      <Controller
        control={control}
        name="email"
        render={({ field: { value, onChange, onBlur } }) => (
          <FormControl isInvalid={!!errors.email}>
            <FilledInput>
              <InputField
                placeholder="メールアドレス"
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                autoCapitalize="none"
                keyboardType="email-address"
              />
            </FilledInput>
            <FormControlError>
              <FormControlErrorText>{errors.email?.message}</FormControlErrorText>
            </FormControlError>
          </FormControl>
        )}
      />

      <Controller
        control={control}
        name="password"
        render={({ field: { value, onChange, onBlur } }) => (
          <FormControl isInvalid={!!errors.password}>
            <FilledInput>
              <InputField
                placeholder="パスワード"
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                secureTextEntry
              />
            </FilledInput>
            <FormControlError>
              <FormControlErrorText>{errors.password?.message}</FormControlErrorText>
            </FormControlError>
          </FormControl>
        )}
      />

      <Button onPress={handleSubmit(onSubmit)} isDisabled={loading} className="mt-2">
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
