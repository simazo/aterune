import { createSessionFromUrl, updatePassword, type EmailConfirmationResult } from '@/api/auth';
import { savePushTokenForCurrentUser } from '@/api/push-tokens';
import { FormTextField } from '@/components/form-text-field';
import { Button, ButtonSpinner, ButtonText } from '@/components/ui/button';
import { Heading } from '@/components/ui/heading';
import { Spinner } from '@/components/ui/spinner';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { useAuth } from '@/hooks/use-auth';
import { useErrorToast } from '@/hooks/use-error-toast';
import { useSuccessToast } from '@/hooks/use-success-toast';
import { getAuthErrorMessage } from '@/utils/auth-error';
import { zodResolver } from '@hookform/resolvers/zod';
import { useLinkingURL } from 'expo-linking';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Platform } from 'react-native';
import { resetPasswordSchema, type ResetPasswordFormValues } from './schema';

const NO_PARAMS: EmailConfirmationResult = { status: 'no-params' };

export function ResetPassword() {
  const router = useRouter();
  const url = useLinkingURL();
  const { session } = useAuth();
  const showError = useErrorToast();
  const showSuccess = useSuccessToast();
  const [linkResult, setLinkResult] = useState<EmailConfirmationResult | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const handledUrl = useRef<string | null>(null);
  const { control, handleSubmit } = useForm<ResetPasswordFormValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: '', passwordConfirm: '' },
  });

  // URLが無い場合はstateを使わず、描画時に結果を決める
  const result: EmailConfirmationResult | null = url ? linkResult : NO_PARAMS;

  useEffect(() => {
    if (!url) return;
    // 同じURLを二重に処理しない（StrictModeでのeffect二重実行対策）
    if (handledUrl.current === url) return;
    handledUrl.current = url;

    (async () => {
      const linkResult = await createSessionFromUrl(url);
      setLinkResult(linkResult);
      // リンクを開いた時点でログイン状態になる（パスワードを変えずに離れてもログインしたまま）ため、ここで保存する
      // （savePushTokenForCurrentUser は失敗しても例外を投げないので、待たなくてよい）
      if (linkResult.status === 'success') {
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

  async function onSubmit({ password }: ResetPasswordFormValues) {
    setIsUpdating(true);

    try {
      const { error } = await updatePassword(password);

      if (error) {
        // 今と同じパスワードなど。この画面のまま入力し直してもらう
        showError(getAuthErrorMessage(error));
        return;
      }
      showSuccess('パスワードを変更しました');
      router.replace('/');
    } finally {
      setIsUpdating(false);
    }
  }

  if (!result) {
    return (
      <VStack className="flex-1 items-center justify-center bg-background p-6" space="md">
        <Spinner size="large" />
        <Text size="md">確認しています…</Text>
      </VStack>
    );
  }

  // リンクから開いていない・リンクが無効なときは入力欄を出さない
  // （ログイン中にこの画面を直接開いて、今のパスワードを聞かずに変更できる入口にしないため）
  if (result.status !== 'success') {
    const { heading, message } = getFailureText(result);

    return (
      <VStack className="flex-1 justify-center bg-background p-6" space="md">
        <Heading size="xl" className="mb-3 text-center">
          {heading}
        </Heading>
        <Text size="md" className="text-center">
          {message}
        </Text>
        {/* /forgot-password は未ログイン専用で、ログイン中は / へ移されるため、ボタンを分ける */}
        {session ? (
          <Button onPress={() => router.replace('/')} className="mt-2">
            <ButtonText>ホームに戻る</ButtonText>
          </Button>
        ) : (
          <Button onPress={() => router.replace('/forgot-password')} className="mt-2">
            <ButtonText>再設定メールを送り直す</ButtonText>
          </Button>
        )}
      </VStack>
    );
  }

  return (
    <VStack className="flex-1 justify-center bg-background p-6" space="md">
      <Heading size="xl" className="mb-3">
        新しいパスワードの設定
      </Heading>

      <FormTextField
        control={control}
        name="password"
        placeholder="新しいパスワード"
        secureTextEntry
      />

      <FormTextField
        control={control}
        name="passwordConfirm"
        placeholder="新しいパスワード（確認用）"
        secureTextEntry
      />

      <Button onPress={handleSubmit(onSubmit)} isDisabled={isUpdating} className="mt-2">
        {isUpdating ? <ButtonSpinner /> : <ButtonText>パスワードを変更する</ButtonText>}
      </Button>
    </VStack>
  );
}

function getFailureText(result: Exclude<EmailConfirmationResult, { status: 'success' }>) {
  if (result.status === 'no-params') {
    return {
      heading: 'パスワードの再設定',
      message: '再設定メールのリンクからこの画面を開いてください。',
    };
  }

  if (result.errorCode === 'otp_expired') {
    return {
      heading: 'リンクが無効です',
      message: 'リンクの有効期限が切れているか、すでに使用されています。\n再設定メールを送り直してください。',
    };
  }

  return {
    heading: 'パスワードの再設定に失敗しました',
    message: '時間をおいて、もう一度お試しください。',
  };
}
