import { applyToConsultationPost } from '@/api/consultation-posts';
import { FilledInput } from '@/components/filled-input';
import { Badge, BadgeText } from '@/components/ui/badge';
import { Button, ButtonSpinner, ButtonText } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  FormControl,
  FormControlError,
  FormControlErrorText,
  FormControlLabel,
  FormControlLabelText,
} from '@/components/ui/form-control';
import { HStack } from '@/components/ui/hstack';
import { InputField } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { useErrorToast } from '@/hooks/use-error-toast';
import { useSuccessToast } from '@/hooks/use-success-toast';
import type { ConsultationPostListItem } from '@/types';
import { getConsultationApplyErrorMessage } from '@/utils/consultation-apply-error';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { type ConcernApplyFormValues, concernApplySchema } from '../schema';

type Props = {
  post: ConsultationPostListItem;
};

// 応募のフォーム。応募先のお悩みを上に出し、ひとこと（任意）を添えて応募する
export function ConcernApplyForm({ post }: Props) {
  const router = useRouter();
  const showError = useErrorToast();
  const showSuccess = useSuccessToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<ConcernApplyFormValues>({
    resolver: zodResolver(concernApplySchema),
    defaultValues: { message: '' },
  });

  async function onSubmit({ message }: ConcernApplyFormValues) {
    setIsSubmitting(true);

    const { error } = await applyToConsultationPost({ postId: post.id, message });
    if (error) {
      showError(getConsultationApplyErrorMessage(error));
      setIsSubmitting(false);
      return;
    }

    showSuccess('応募しました');
    // お悩みの詳細まで戻る。URL から直接開いたときは、下にタブ（(tabs)）しか無いため back() だとタブに戻ってしまう。
    // dismissTo は履歴に詳細画面が無ければ、この画面を詳細画面に置き換える
    router.dismissTo({ pathname: '/concerns/[id]', params: { id: post.id } });
  }

  return (
    <VStack space="lg">
      <Card>
        <VStack space="sm">
          <HStack>
            <Badge variant="secondary">
              <BadgeText>{post.concern_tag_name}</BadgeText>
            </Badge>
          </HStack>
          <Text size="md">{post.concern}</Text>
        </VStack>
      </Card>

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
                placeholder="相談者へのひとこと"
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

      {/* 承認されなかったときに再び応募できないことを、応募の前に伝える */}
      <VStack space="xs">
        <Text size="sm" className="text-muted-foreground">
          ・相談者が承認すると、やり取りが始まります
        </Text>
        <Text size="sm" className="text-muted-foreground">
          ・承認されなかった場合も、このお悩みには再び応募できません
        </Text>
      </VStack>

      <Button size="lg" onPress={handleSubmit(onSubmit)} isDisabled={isSubmitting}>
        {isSubmitting ? <ButtonSpinner /> : <ButtonText>応募する</ButtonText>}
      </Button>
    </VStack>
  );
}
