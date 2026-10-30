import { reportUser } from '@/api/reports';
import { FilledTextarea } from '@/components/filled-textarea';
import { SelectableButton } from '@/components/selectable-button';
import { Button, ButtonSpinner, ButtonText } from '@/components/ui/button';
import {
  FormControl,
  FormControlError,
  FormControlErrorText,
  FormControlHelper,
  FormControlHelperText,
  FormControlLabel,
  FormControlLabelText,
} from '@/components/ui/form-control';
import { TextareaInput } from '@/components/ui/textarea';
import { VStack } from '@/components/ui/vstack';
import { useErrorToast } from '@/hooks/use-error-toast';
import { useSuccessToast } from '@/hooks/use-success-toast';
import type { ReportReason } from '@/types';
import { Constants } from '@/types/database.types';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { reportSchema, type ReportFormValues } from '../schema';

// 理由の表示名。並びは DB の enum report_reason の定義順
const REPORT_REASON_LABELS: Record<ReportReason, string> = {
  inappropriate_content: '不適切な内容',
  harassment: '嫌がらせ・誹謗中傷',
  spam: 'スパム・宣伝',
  external_solicitation: '外部サービスへの誘導',
  impersonation: 'なりすまし',
  other: 'その他',
};

type Props = {
  reporterId: string;
  reportedUserId: string;
  sessionId: string | null;
};

// 通報の入力フォーム。理由を1つ選び、詳しい内容は任意。送信したら前の画面に戻る
export function ReportForm({ reporterId, reportedUserId, sessionId }: Props) {
  const router = useRouter();
  const showError = useErrorToast();
  const showSuccess = useSuccessToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<ReportFormValues>({
    resolver: zodResolver(reportSchema),
    // 理由は未選択から始める（schema で必須にしている）
    defaultValues: { detail: '' },
  });

  async function onSubmit({ reason, detail }: ReportFormValues) {
    setIsSubmitting(true);

    const { error } = await reportUser({ reporterId, reportedUserId, sessionId, reason, detail });
    if (error) {
      // 理由と文字数は画面で確かめているので、DB に弾かれるのは通信エラーなどに限られる
      showError('通報できませんでした。時間をおいて、もう一度お試しください');
      setIsSubmitting(false);
      return;
    }

    showSuccess('通報を受け付けました');
    // URL から直接開いて戻る先が無ければ、さがすタブへ移る
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/');
    }
  }

  return (
    <VStack space="xl">
      <Controller
        control={control}
        name="reason"
        render={({ field: { value, onChange } }) => (
          <FormControl isInvalid={!!errors.reason}>
            <FormControlLabel>
              <FormControlLabelText>理由</FormControlLabelText>
            </FormControlLabel>
            <VStack space="sm">
              {Constants.public.Enums.report_reason.map((reason) => (
                <SelectableButton
                  key={reason}
                  label={REPORT_REASON_LABELS[reason]}
                  isSelected={value === reason}
                  onPress={() => onChange(reason)}
                />
              ))}
            </VStack>
            <FormControlError>
              <FormControlErrorText>{errors.reason?.message}</FormControlErrorText>
            </FormControlError>
          </FormControl>
        )}
      />

      <Controller
        control={control}
        name="detail"
        render={({ field: { value, onChange, onBlur } }) => (
          <FormControl isInvalid={!!errors.detail}>
            <FormControlLabel>
              <FormControlLabelText>詳しい内容（任意）</FormControlLabelText>
            </FormControlLabel>
            <FilledTextarea className="h-40">
              <TextareaInput
                placeholder="いつ・どのようなことがあったかを書いてください"
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                accessibilityLabel="詳しい内容"
              />
            </FilledTextarea>
            <FormControlHelper>
              <FormControlHelperText>500文字まで</FormControlHelperText>
            </FormControlHelper>
            <FormControlError>
              <FormControlErrorText>{errors.detail?.message}</FormControlErrorText>
            </FormControlError>
          </FormControl>
        )}
      />

      <Button size="lg" onPress={handleSubmit(onSubmit)} isDisabled={isSubmitting}>
        {isSubmitting ? <ButtonSpinner /> : <ButtonText>通報する</ButtonText>}
      </Button>
    </VStack>
  );
}
