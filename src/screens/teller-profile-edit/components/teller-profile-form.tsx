import { saveTellerProfile } from '@/api/tellers';
import { FilledInput } from '@/components/filled-input';
import { FilledTextarea } from '@/components/filled-textarea';
import { Button, ButtonSpinner, ButtonText } from '@/components/ui/button';
import {
  FormControl,
  FormControlError,
  FormControlErrorText,
  FormControlLabel,
  FormControlLabelText,
} from '@/components/ui/form-control';
import { HStack } from '@/components/ui/hstack';
import { InputField } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Text } from '@/components/ui/text';
import { TextareaInput } from '@/components/ui/textarea';
import { VStack } from '@/components/ui/vstack';
import { useErrorToast } from '@/hooks/use-error-toast';
import { useSuccessToast } from '@/hooks/use-success-toast';
import type { Tag } from '@/types';
import { CATEGORY_LABELS } from '@/utils/teller';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { tellerProfileEditSchema, type TellerProfileEditFormValues } from '../schema';
import { TagSelectSection } from './tag-select-section';

type Props = {
  tags: Pick<Tag, 'id' | 'category' | 'name'>[];
  defaultValues: TellerProfileEditFormValues;
  // 占い師として未登録なら true（登録として表示する）
  isNew: boolean;
};

// 占い師プロフィールのフォーム。登録と編集の両方で使う（保存はどちらも save_teller_profile）
export function TellerProfileForm({ tags, defaultValues, isNew }: Props) {
  const router = useRouter();
  const showError = useErrorToast();
  const showSuccess = useSuccessToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<TellerProfileEditFormValues>({
    resolver: zodResolver(tellerProfileEditSchema),
    defaultValues,
  });

  async function onSubmit(values: TellerProfileEditFormValues) {
    setIsSubmitting(true);

    const { error } = await saveTellerProfile({
      selfPr: values.selfPr,
      trainingPeriod: values.trainingPeriod,
      requiresBirthdate: values.requiresBirthdate,
      isAccepting: values.isAccepting,
      tagIds: [...values.divinationTagIds, ...values.concernTagIds, ...values.styleTagIds],
    });
    if (error) {
      showError(isNew ? '占い師として登録できませんでした' : '占い師プロフィールを保存できませんでした');
      setIsSubmitting(false);
      return;
    }

    showSuccess(isNew ? '占い師として登録しました' : '保存しました');
    // マイページまで戻る。URL から直接開いたときは履歴にマイページが無いため、back() ではなく dismissTo を使う
    router.dismissTo('/mypage');
  }

  return (
    <VStack space="lg">
      <Controller
        control={control}
        name="divinationTagIds"
        render={({ field: { value, onChange } }) => (
          <TagSelectSection
            label={`${CATEGORY_LABELS.divination}（1つ以上）`}
            tags={tags.filter((tag) => tag.category === 'divination')}
            selectedIds={value}
            onChange={onChange}
            errorMessage={errors.divinationTagIds?.message}
          />
        )}
      />

      <Controller
        control={control}
        name="concernTagIds"
        render={({ field: { value, onChange } }) => (
          <TagSelectSection
            label={`得意な${CATEGORY_LABELS.concern}（任意）`}
            tags={tags.filter((tag) => tag.category === 'concern')}
            selectedIds={value}
            onChange={onChange}
          />
        )}
      />

      <Controller
        control={control}
        name="styleTagIds"
        render={({ field: { value, onChange } }) => (
          <TagSelectSection
            label={`${CATEGORY_LABELS.style}（任意）`}
            tags={tags.filter((tag) => tag.category === 'style')}
            selectedIds={value}
            onChange={onChange}
          />
        )}
      />

      <Controller
        control={control}
        name="selfPr"
        render={({ field: { value, onChange, onBlur } }) => (
          <FormControl isInvalid={!!errors.selfPr}>
            <FormControlLabel>
              <FormControlLabelText>自己PR（任意）</FormControlLabelText>
            </FormControlLabel>
            <FilledTextarea className="h-60">
              <TextareaInput
                placeholder="経歴や得意な占術、鑑定のスタイルなど"
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
              />
            </FilledTextarea>
            <FormControlError>
              <FormControlErrorText>{errors.selfPr?.message}</FormControlErrorText>
            </FormControlError>
          </FormControl>
        )}
      />

      <Controller
        control={control}
        name="trainingPeriod"
        render={({ field: { value, onChange, onBlur } }) => (
          <FormControl isInvalid={!!errors.trainingPeriod}>
            <FormControlLabel>
              <FormControlLabelText>修行期間（任意）</FormControlLabelText>
            </FormControlLabel>
            <FilledInput>
              <InputField
                placeholder="例：半年、3年"
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
              />
            </FilledInput>
            <FormControlError>
              <FormControlErrorText>{errors.trainingPeriod?.message}</FormControlErrorText>
            </FormControlError>
          </FormControl>
        )}
      />

      <Controller
        control={control}
        name="isAccepting"
        render={({ field: { value, onChange } }) => (
          <HStack className="items-center justify-between" space="md">
            <Text size="md" className="flex-1">
              申込みを受け付ける
            </Text>
            <Switch value={value} onValueChange={onChange} accessibilityLabel="申込みを受け付ける" />
          </HStack>
        )}
      />

      <Controller
        control={control}
        name="requiresBirthdate"
        render={({ field: { value, onChange } }) => (
          <HStack className="items-center justify-between" space="md">
            <Text size="md" className="flex-1">
              申込み時に相談者の生年月日を必須にする
            </Text>
            <Switch
              value={value}
              onValueChange={onChange}
              accessibilityLabel="申込み時に相談者の生年月日を必須にする"
            />
          </HStack>
        )}
      />

      <Button
        size="lg"
        // 占術の欄は画面の上にあり、下の登録ボタンを押した位置からはエラーが見えないため、Toast でも知らせる
        onPress={handleSubmit(onSubmit, () => showError('入力内容を確認してください'))}
        isDisabled={isSubmitting}
      >
        {isSubmitting ? <ButtonSpinner /> : <ButtonText>{isNew ? '登録する' : '保存する'}</ButtonText>}
      </Button>
    </VStack>
  );
}
