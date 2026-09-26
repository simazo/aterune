import { Button, ButtonText } from '@/components/ui/button';
import { Heading } from '@/components/ui/heading';
import { Spinner } from '@/components/ui/spinner';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { createSessionFromUrl, type EmailConfirmationResult } from '@/lib/auth';
import { savePushTokenForCurrentUser } from '@/lib/pushToken';
import { useLinkingURL } from 'expo-linking';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';

export function AuthConfirmed() {
  const router = useRouter();
  const url = useLinkingURL();
  const [result, setResult] = useState<EmailConfirmationResult | null>(null);
  const handledUrl = useRef<string | null>(null);

  useEffect(() => {
    if (!url) {
      setResult({ status: 'no-params' });
      return;
    }
    // 同じURLを二重に処理しない（StrictModeでのeffect二重実行対策）
    if (handledUrl.current === url) return;
    handledUrl.current = url;

    (async () => {
      const confirmation = await createSessionFromUrl(url);
      if (confirmation.status === 'success') {
        await savePushTokenForCurrentUser();
      }
      setResult(confirmation);
    })();
  }, [url]);

  // Web版はアドレスバーにトークンが残らないよう、結果の表示後に#以降を消す
  useEffect(() => {
    if (Platform.OS === 'web' && result && window.location.hash) {
      window.history.replaceState(null, '', window.location.pathname);
    }
  }, [result]);

  if (!result) {
    return (
      <VStack className="flex-1 items-center justify-center bg-background p-6" space="md">
        <Spinner size="large" />
        <Text size="md">確認しています…</Text>
      </VStack>
    );
  }

  if (result.status === 'success') {
    return (
      <VStack className="flex-1 justify-center bg-background p-6" space="md">
        <Heading size="xl" className="mb-3 text-center">
          登録が完了しました
        </Heading>
        <Text size="md" className="text-center">
          ようこそ、アテルネへ。
        </Text>
        <Button onPress={() => router.replace('/(app)')} className="mt-2">
          <ButtonText>はじめる</ButtonText>
        </Button>
      </VStack>
    );
  }

  const { heading, message } = getFailureText(result);

  return (
    <VStack className="flex-1 justify-center bg-background p-6" space="md">
      <Heading size="xl" className="mb-3 text-center">
        {heading}
      </Heading>
      <Text size="md" className="text-center">
        {message}
      </Text>
      <Button onPress={() => router.replace('/login')} className="mt-2">
        <ButtonText>ログイン画面へ</ButtonText>
      </Button>
    </VStack>
  );
}

function getFailureText(result: Exclude<EmailConfirmationResult, { status: 'success' }>) {
  if (result.status === 'no-params') {
    return {
      heading: 'メール確認',
      message: '確認メールのリンクからこの画面を開いてください。\n確認が済んでいる場合は、そのままログインできます。',
    };
  }

  if (result.errorCode === 'otp_expired') {
    return {
      heading: 'リンクが無効です',
      message: 'リンクの有効期限が切れているか、すでに使用されています。\n確認が済んでいる場合は、そのままログインできます。',
    };
  }

  return {
    heading: 'メール確認に失敗しました',
    message: '時間をおいて、もう一度お試しください。\n確認が済んでいる場合は、そのままログインできます。',
  };
}
