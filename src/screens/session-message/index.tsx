import { sendMessage } from '@/api/messages';
import { FilledTextarea } from '@/components/filled-textarea';
import { Button, ButtonSpinner, ButtonText } from '@/components/ui/button';
import {
  FormControl,
  FormControlError,
  FormControlErrorText,
  FormControlHelper,
  FormControlHelperText,
} from '@/components/ui/form-control';
import { ScrollView } from '@/components/ui/scroll-view';
import { TextareaInput } from '@/components/ui/textarea';
import { VStack } from '@/components/ui/vstack';
import { useAuth } from '@/hooks/use-auth';
import { useErrorToast } from '@/hooks/use-error-toast';
import { useSuccessToast } from '@/hooks/use-success-toast';
import { zodResolver } from '@hookform/resolvers/zod';
import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { messageSchema, type MessageFormValues } from './schema';

type Props = {
  sessionId: string;
};

// セッションのメッセージを書く画面。入力欄を画面の上の方に置き、キーボードに隠れないようにする
// （詳細画面の下に固定するとキーボードへの対応が必要になるため、書く画面を分けている）。
// 進行中でないセッション・当事者でない人の送信は DB の RLS が弾く
export function SessionMessage({ sessionId }: Props) {
  const router = useRouter();
  const showError = useErrorToast();
  const showSuccess = useSuccessToast();
  const { session } = useAuth();
  const userId = session?.user.id;
  const [isSubmitting, setIsSubmitting] = useState(false);
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<MessageFormValues>({
    resolver: zodResolver(messageSchema),
    defaultValues: { content: '' },
  });

  async function onSubmit({ content }: MessageFormValues) {
    // (app) のレイアウトがログイン済みを保証しているので、userId が無いことは無い
    if (!userId) return;
    setIsSubmitting(true);

    const { error } = await sendMessage({ sessionId, senderId: userId, content });
    if (error) {
      showError('メッセージを送れませんでした。時間をおいて、もう一度お試しください');
      setIsSubmitting(false);
      return;
    }

    showSuccess('送信しました');
    // 詳細画面まで戻る（詳細画面は表示されたときにメッセージを読み直す）。
    // URL から直接開いたときは、下にタブ（(tabs)）しか無いため back() だとタブに戻ってしまう。
    // dismissTo は履歴に詳細画面が無ければ、この画面を詳細画面に置き換える
    router.dismissTo({ pathname: '/sessions/[id]', params: { id: sessionId } });
  }

  return (
    <ScrollView className="flex-1 bg-background" contentContainerClassName="p-4">
      {/* ヘッダーは (app) の Stack で非表示にしているため、この画面だけ表示する。戻るボタンは矢印だけにする */}
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'メッセージを書く',
          headerBackButtonDisplayMode: 'minimal',
        }}
      />

      {/* 広い画面（Web）で横に間延びしないよう、幅を抑えて中央に置く */}
      <VStack space="lg" className="w-full max-w-2xl self-center">
        <Controller
          control={control}
          name="content"
          render={({ field: { value, onChange, onBlur } }) => (
            <FormControl isInvalid={!!errors.content}>
              <FilledTextarea className="h-60">
                <TextareaInput
                  placeholder="メッセージを入力してください"
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  accessibilityLabel="メッセージ"
                />
              </FilledTextarea>
              <FormControlHelper>
                <FormControlHelperText>1000文字まで</FormControlHelperText>
              </FormControlHelper>
              <FormControlError>
                <FormControlErrorText>{errors.content?.message}</FormControlErrorText>
              </FormControlError>
            </FormControl>
          )}
        />

        <Button size="lg" onPress={handleSubmit(onSubmit)} isDisabled={isSubmitting}>
          {isSubmitting ? <ButtonSpinner /> : <ButtonText>送信する</ButtonText>}
        </Button>
      </VStack>
    </ScrollView>
  );
}
