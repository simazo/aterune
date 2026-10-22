import { saveMyPrivateDetails } from '@/api/profile-private-details';
import { updateMyProfile } from '@/api/profiles';
import { BirthdateSelect } from '@/components/birthdate-select';
import { FilledInput } from '@/components/filled-input';
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
import { HStack } from '@/components/ui/hstack';
import { InputField } from '@/components/ui/input';
import { TextareaInput } from '@/components/ui/textarea';
import { VStack } from '@/components/ui/vstack';
import { useErrorToast } from '@/hooks/use-error-toast';
import { useSuccessToast } from '@/hooks/use-success-toast';
import type { Gender } from '@/types';
import { getPrivateDetailsToSave } from '@/utils/profile-private-details';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { profileEditSchema, type ProfileEditFormValues } from '../schema';

// 性別の選択肢。「回答しない」は null で保存する
const GENDER_OPTIONS: { label: string; value: Gender | null }[] = [
  { label: '女性', value: 'female' },
  { label: '男性', value: 'male' },
  { label: 'その他', value: 'other' },
  { label: '回答しない', value: null },
];

type Props = {
  userId: string;
  displayName: string;
  bio: string | null;
  // 登録済みの生年月日（'YYYY-MM-DD'）と性別。未登録なら null
  savedBirthdate: string | null;
  savedGender: Gender | null;
};

// プロフィール編集のフォーム。表示名・自己紹介は公開、生年月日・性別は非公開の情報として保存する
export function ProfileEditForm({ userId, displayName, bio, savedBirthdate, savedGender }: Props) {
  const router = useRouter();
  const showError = useErrorToast();
  const showSuccess = useSuccessToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  // 保存済みの生年月日・性別。非公開の情報の保存に失敗して送り直すとき、変わっていなければ保存し直さないよう、保存したら更新する
  const [currentPrivateDetails, setCurrentPrivateDetails] = useState({
    birthdate: savedBirthdate,
    gender: savedGender,
  });
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<ProfileEditFormValues>({
    resolver: zodResolver(profileEditSchema),
    defaultValues: {
      displayName,
      bio: bio ?? '',
      birthdate: savedBirthdate ?? '',
      gender: savedGender,
    },
  });

  async function onSubmit(values: ProfileEditFormValues) {
    setIsSubmitting(true);

    const { error } = await updateMyProfile(userId, {
      displayName: values.displayName,
      bio: values.bio,
    });
    if (error) {
      showError('プロフィールを保存できませんでした');
      setIsSubmitting(false);
      return;
    }

    // 生年月日が空（未選択・選び途中）なら今の値を変えない。変わっていなければ保存しない
    const nextPrivateDetails = getPrivateDetailsToSave(values, currentPrivateDetails);
    if (nextPrivateDetails) {
      const { error: detailsError } = await saveMyPrivateDetails(userId, nextPrivateDetails);
      if (detailsError) {
        showError('プロフィールは保存しましたが、生年月日・性別を保存できませんでした');
        setIsSubmitting(false);
        return;
      }
      setCurrentPrivateDetails(nextPrivateDetails);
    }

    showSuccess('保存しました');
    // マイページまで戻る。URL から直接開いたときは履歴にマイページが無いため、back() ではなく dismissTo を使う
    router.dismissTo('/mypage');
  }

  return (
    <VStack space="lg">
      <Controller
        control={control}
        name="displayName"
        render={({ field: { value, onChange, onBlur } }) => (
          <FormControl isInvalid={!!errors.displayName}>
            <FormControlLabel>
              <FormControlLabelText>表示名</FormControlLabelText>
            </FormControlLabel>
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
        name="bio"
        render={({ field: { value, onChange, onBlur } }) => (
          <FormControl isInvalid={!!errors.bio}>
            <FormControlLabel>
              <FormControlLabelText>自己紹介（任意）</FormControlLabelText>
            </FormControlLabel>
            <FilledTextarea className="h-40">
              <TextareaInput
                placeholder="趣味や、占いに興味を持ったきっかけなど"
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
              />
            </FilledTextarea>
            <FormControlError>
              <FormControlErrorText>{errors.bio?.message}</FormControlErrorText>
            </FormControlError>
          </FormControl>
        )}
      />

      <Controller
        control={control}
        name="birthdate"
        render={({ field: { value, onChange } }) => (
          <FormControl isInvalid={!!errors.birthdate}>
            <FormControlLabel>
              <FormControlLabelText>生年月日（任意）</FormControlLabelText>
            </FormControlLabel>
            <BirthdateSelect value={value} onChange={onChange} />
            <FormControlHelper>
              <FormControlHelperText>年・月・日をすべて選ぶと変更されます</FormControlHelperText>
            </FormControlHelper>
            <FormControlError>
              <FormControlErrorText>{errors.birthdate?.message}</FormControlErrorText>
            </FormControlError>
          </FormControl>
        )}
      />

      <Controller
        control={control}
        name="gender"
        render={({ field: { value, onChange } }) => (
          <FormControl>
            <FormControlLabel>
              <FormControlLabelText>性別（任意）</FormControlLabelText>
            </FormControlLabel>
            <HStack className="flex-wrap" space="sm">
              {GENDER_OPTIONS.map((option) => (
                <SelectableButton
                  key={option.label}
                  label={option.label}
                  isSelected={value === option.value}
                  onPress={() => onChange(option.value)}
                />
              ))}
            </HStack>
            <FormControlHelper>
              <FormControlHelperText>
                生年月日と性別は公開されず、セッションの相手の占い師にだけ開示されます
              </FormControlHelperText>
            </FormControlHelper>
          </FormControl>
        )}
      />

      <Button size="lg" onPress={handleSubmit(onSubmit)} isDisabled={isSubmitting}>
        {isSubmitting ? <ButtonSpinner /> : <ButtonText>保存する</ButtonText>}
      </Button>
    </VStack>
  );
}
