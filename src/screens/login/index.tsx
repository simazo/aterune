import { Button, ButtonSpinner, ButtonText } from '@/components/ui/button';
import { FormControl, FormControlError, FormControlErrorText } from '@/components/ui/form-control';
import { Heading } from '@/components/ui/heading';
import { Input, InputField } from '@/components/ui/input';
import { Link, LinkText } from '@/components/ui/link';
import { VStack } from '@/components/ui/vstack';
import { useErrorToast } from '@/hooks/use-error-toast';
import { savePushTokenForCurrentUser } from '@/lib/pushToken';
import { supabase } from '@/lib/supabase';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { loginSchema, type LoginFormValues } from './schema';

export function Login() {
  const router = useRouter();
  const showError = useErrorToast();
  const [loading, setLoading] = useState(false);
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  async function onSubmit({ email, password }: LoginFormValues) {
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      showError(error.message);
    } else {
      // ログイン成功 → push token登録
      await savePushTokenForCurrentUser();
    }
    setLoading(false);
  }

  return (
    <VStack className="flex-1 justify-center bg-background p-6" space="md">
      <Heading size="xl" className="mb-3">
        ログイン
      </Heading>

      <Controller
        control={control}
        name="email"
        render={({ field: { value, onChange, onBlur } }) => (
          <FormControl isInvalid={!!errors.email}>
            <Input>
              <InputField
                placeholder="メールアドレス"
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                autoCapitalize="none"
                keyboardType="email-address"
              />
            </Input>
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
            <Input>
              <InputField
                placeholder="パスワード"
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                secureTextEntry
              />
            </Input>
            <FormControlError>
              <FormControlErrorText>{errors.password?.message}</FormControlErrorText>
            </FormControlError>
          </FormControl>
        )}
      />

      <Button onPress={handleSubmit(onSubmit)} isDisabled={loading} className="mt-2">
        {loading ? <ButtonSpinner /> : <ButtonText>ログイン</ButtonText>}
      </Button>

      <Link onPress={() => router.push('/signup')}>
        <LinkText className="mt-2 text-center" size="sm">
          アカウントをお持ちでない方はこちら
        </LinkText>
      </Link>
    </VStack>
  );
}
