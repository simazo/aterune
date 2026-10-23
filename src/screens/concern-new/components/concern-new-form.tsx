import { createConsultationPost } from '@/api/consultation-posts';
import { FilledTextarea } from '@/components/filled-textarea';
import { SelectableButton } from '@/components/selectable-button';
import { Button, ButtonSpinner, ButtonText } from '@/components/ui/button';
import {
  FormControl,
  FormControlError,
  FormControlErrorText,
  FormControlLabel,
  FormControlLabelText,
} from '@/components/ui/form-control';
import { HStack } from '@/components/ui/hstack';
import { Text } from '@/components/ui/text';
import { TextareaInput } from '@/components/ui/textarea';
import { VStack } from '@/components/ui/vstack';
import { useErrorToast } from '@/hooks/use-error-toast';
import { useSuccessToast } from '@/hooks/use-success-toast';
import type { Tag } from '@/types';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { type ConcernNewFormValues, concernNewSchema } from '../schema';

type Props = {
  consultantId: string;
  // 選択肢にする悩みタグ（表示順に並べたもの）
  concernTags: Pick<Tag, 'id' | 'name'>[];
};

// お悩みの投稿フォーム。悩みの種類を1つ選び、内容を書く
export function ConcernNewForm({ consultantId, concernTags }: Props) {
  const router = useRouter();
  const showError = useErrorToast();
  const showSuccess = useSuccessToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<ConcernNewFormValues>({
    resolver: zodResolver(concernNewSchema),
    defaultValues: { concernTagId: '', concern: '' },
  });

  async function onSubmit({ concernTagId, concern }: ConcernNewFormValues) {
    setIsSubmitting(true);

    const { error } = await createConsultationPost({ consultantId, concernTagId, concern });
    if (error) {
      // タグと文字数は画面で確かめているので、DB に弾かれるのは通信エラーなどに限られる
      showError('投稿できませんでした。時間をおいて、もう一度お試しください');
      setIsSubmitting(false);
      return;
    }

    showSuccess('投稿しました');
    // お悩み一覧へ戻る。URL から直接開いたときも、履歴に無ければこの画面を一覧に置き換える
    router.dismissTo('/concerns');
  }

  return (
    <VStack space="lg">
      <Controller
        control={control}
        name="concernTagId"
        render={({ field: { value, onChange } }) => (
          <FormControl isInvalid={!!errors.concernTagId}>
            <FormControlLabel>
              <FormControlLabelText>悩みの種類</FormControlLabelText>
            </FormControlLabel>
            <HStack className="flex-wrap" space="xs">
              {concernTags.map((tag) => (
                <SelectableButton
                  key={tag.id}
                  label={tag.name}
                  isSelected={value === tag.id}
                  onPress={() => onChange(tag.id)}
                />
              ))}
            </HStack>
            <FormControlError>
              <FormControlErrorText>{errors.concernTagId?.message}</FormControlErrorText>
            </FormControlError>
          </FormControl>
        )}
      />

      <Controller
        control={control}
        name="concern"
        render={({ field: { value, onChange, onBlur } }) => (
          <FormControl isInvalid={!!errors.concern}>
            <FormControlLabel>
              <FormControlLabelText>お悩みの内容</FormControlLabelText>
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

      {/* 匿名の範囲（一覧では匿名、応募した占い師には伝わる）と、編集できないことを投稿前に伝える */}
      <VStack space="xs">
        <Text size="sm" className="text-muted-foreground">
          ・お悩みは匿名で一覧に表示されます。応募した占い師には、あなたの表示名が伝わります
        </Text>
        <Text size="sm" className="text-muted-foreground">
          ・投稿したあとは編集できません（閉じることはできます）
        </Text>
      </VStack>

      <Button size="lg" onPress={handleSubmit(onSubmit)} isDisabled={isSubmitting}>
        {isSubmitting ? <ButtonSpinner /> : <ButtonText>投稿する</ButtonText>}
      </Button>
    </VStack>
  );
}
