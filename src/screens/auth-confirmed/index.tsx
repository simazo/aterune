import { createSessionFromUrl, type EmailConfirmationResult } from '@/api/auth';
import { savePushTokenForCurrentUser } from '@/api/push-tokens';
import { Button, ButtonText } from '@/components/ui/button';
import { Heading } from '@/components/ui/heading';
import { Spinner } from '@/components/ui/spinner';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { useReplaceAfterDismiss } from '@/hooks/use-replace-after-dismiss';
import { useLinkingURL } from 'expo-linking';
import { useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';

const NO_PARAMS: EmailConfirmationResult = { status: 'no-params' };

export function AuthConfirmed() {
  const replaceAfterDismiss = useReplaceAfterDismiss();
  const url = useLinkingURL();
  const [confirmation, setConfirmation] = useState<EmailConfirmationResult | null>(null);
  const handledUrl = useRef<string | null>(null);

  // URLが無い場合はstateを使わず、描画時に結果を決める
  const result: EmailConfirmationResult | null = url ? confirmation : NO_PARAMS;

  useEffect(() => {
    if (!url) return;
    // 同じURLを二重に処理しない（StrictModeでのeffect二重実行対策）
    if (handledUrl.current === url) return;
    handledUrl.current = url;

    (async () => {
      const confirmation = await createSessionFromUrl(url);
      setConfirmation(confirmation);
      // 通知の許可ダイアログを待たずに完了画面を出す。保存は後ろで行う
      // （savePushTokenForCurrentUser は失敗しても例外を投げないので、待たなくてよい）
      if (confirmation.status === 'success') {
        void savePushTokenForCurrentUser();
      }
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
        <Button onPress={() => replaceAfterDismiss('/')} className="mt-2">
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
      <Button onPress={() => replaceAfterDismiss('/login')} className="mt-2">
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
