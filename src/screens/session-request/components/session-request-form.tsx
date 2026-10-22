import { saveMyBirthdate } from '@/api/profile-private-details';
import { createSessionRequest } from '@/api/sessions';
import { FilledInput } from '@/components/filled-input';
import { FilledTextarea } from '@/components/filled-textarea';
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
import { Heading } from '@/components/ui/heading';
import { InputField } from '@/components/ui/input';
import { TextareaInput } from '@/components/ui/textarea';
import { VStack } from '@/components/ui/vstack';
import { useErrorToast } from '@/hooks/use-error-toast';
import { useSuccessToast } from '@/hooks/use-success-toast';
import type { TellerDetail } from '@/types';
import { getSessionRequestErrorMessage } from '@/utils/session-request-error';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { buildSessionRequestSchema, type SessionRequestFormValues } from '../schema';
import { BirthdateSelect } from '@/components/birthdate-select';

type Props = {
  teller: TellerDetail;
  consultantId: string;
  // 登録済みの生年月日（'YYYY-MM-DD'）。未登録なら null
  savedBirthdate: string | null;
};

// 申込みのフォーム。生年月日は、占い師が必須にしているときだけ入力させる（登録済みなら初期値にする）
export function SessionRequestForm({ teller, consultantId, savedBirthdate }: Props) {
  const router = useRouter();
  const showError = useErrorToast();
  const showSuccess = useSuccessToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  // 保存済みの生年月日。申込みに失敗して送り直すとき、同じ日付を保存し直さないよう、保存したら更新する
  const [currentBirthdate, setCurrentBirthdate] = useState(savedBirthdate);
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<SessionRequestFormValues>({
    resolver: zodResolver(buildSessionRequestSchema(teller.requires_birthdate)),
    defaultValues: { concern: '', message: '', birthdate: savedBirthdate ?? '' },
  });

  async function onSubmit({ concern, message, birthdate }: SessionRequestFormValues) {
    setIsSubmitting(true);

    // 生年月日が未登録か、変えたときだけ保存する（申込みより先に保存しないと、DB が申込みを弾くため）
    if (teller.requires_birthdate && birthdate !== currentBirthdate) {
      const { error } = await saveMyBirthdate(consultantId, birthdate);
      if (error) {
        showError('生年月日を保存できませんでした');
        setIsSubmitting(false);
        return;
      }
      setCurrentBirthdate(birthdate);
    }

    const { error } = await createSessionRequest({
      consultantId,
      tellerId: teller.teller_id,
      concern,
      message,
    });
    if (error) {
      showError(getSessionRequestErrorMessage(error));
      setIsSubmitting(false);
      return;
    }

    showSuccess('申し込みました');
    // 占い師詳細まで戻る。URL から直接開いたときは、下にタブ（(tabs)）しか無いため back() だとタブに戻ってしまう。
    // dismissTo は履歴に詳細画面が無ければ、この画面を詳細画面に置き換える
    router.dismissTo({ pathname: '/tellers/[id]', params: { id: teller.teller_id } });
  }

  return (
    <VStack space="lg">
      <Heading size="lg">{teller.display_name}さんへの申込み</Heading>

      <Controller
        control={control}
        name="concern"
        render={({ field: { value, onChange, onBlur } }) => (
          <FormControl isInvalid={!!errors.concern}>
            <FormControlLabel>
              <FormControlLabelText>相談内容</FormControlLabelText>
            </FormControlLabel>
            <FilledTextarea className="h-80">
              <TextareaInput
                placeholder="占ってほしいことや、いまの状況を書いてください"
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
              />
            </FilledTextarea>
            <FormControlError>
              <FormControlErrorText>{errors.concern?.message}</FormControlErrorText>
            </FormControlError>
          </FormControl>
        )}
      />

      <Controller
        control={control}
        name="message"
        render={({ field: { value, onChange, onBlur } }) => (
          <FormControl isInvalid={!!errors.message}>
            <FormControlLabel>
              <FormControlLabelText>ひとこと（任意）</FormControlLabelText>
            </FormControlLabel>
            <FilledInput>
              <InputField
                placeholder="占い師へのひとこと"
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
              />
            </FilledInput>
            <FormControlError>
              <FormControlErrorText>{errors.message?.message}</FormControlErrorText>
            </FormControlError>
          </FormControl>
        )}
      />

      {teller.requires_birthdate && (
        <Controller
          control={control}
          name="birthdate"
          render={({ field: { value, onChange } }) => (
            <FormControl isInvalid={!!errors.birthdate}>
              <FormControlLabel>
                <FormControlLabelText>生年月日</FormControlLabelText>
              </FormControlLabel>
              <BirthdateSelect value={value} onChange={onChange} />
              <FormControlHelper>
                <FormControlHelperText>
                  生年月日は申込み先の占い師にだけ開示されます
                </FormControlHelperText>
              </FormControlHelper>
              <FormControlError>
                <FormControlErrorText>{errors.birthdate?.message}</FormControlErrorText>
              </FormControlError>
            </FormControl>
          )}
        />
      )}

      <Button size="lg" onPress={handleSubmit(onSubmit)} isDisabled={isSubmitting}>
        {isSubmitting ? <ButtonSpinner /> : <ButtonText>申し込む</ButtonText>}
      </Button>
    </VStack>
  );
}
