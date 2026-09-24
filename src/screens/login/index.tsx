import { Button, ButtonSpinner, ButtonText } from '@/components/ui/button';
import { Heading } from '@/components/ui/heading';
import { Input, InputField } from '@/components/ui/input';
import { Link, LinkText } from '@/components/ui/link';
import { VStack } from '@/components/ui/vstack';
import { useErrorToast } from '@/hooks/use-error-toast';
import { getCurrentPlatform, registerForPushNotificationsAsync } from '@/lib/pushToken';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'expo-router';
import { useState } from 'react';

export function Login() {
  const router = useRouter();
  const showError = useErrorToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSignIn() {
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      showError(error.message);
    } else {
      // ログイン成功 → push token登録
      await registerPushToken();
    }
    setLoading(false);
  }

  async function registerPushToken() {
    const token = await registerForPushNotificationsAsync();
    if (!token) return;

    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    if (!userId) return;

    const { error } = await supabase.from('push_tokens').upsert(
      {
        user_id: userId,
        expo_push_token: token,
        platform: getCurrentPlatform(),
      },
      { onConflict: 'user_id,expo_push_token', ignoreDuplicates: true }
    );

    if (error) {
      console.log('push_tokens登録エラー:', error.message);
    } else {
      console.log('push_tokens登録成功:', token);
    }
  }

  return (
    <VStack className="flex-1 justify-center bg-background p-6" space="md">
      <Heading size="xl" className="mb-3">
        ログイン
      </Heading>

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

      <Button onPress={handleSignIn} isDisabled={loading} className="mt-2">
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
