import { createReview } from '@/api/reviews';
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
import { TextareaInput } from '@/components/ui/textarea';
import { VStack } from '@/components/ui/vstack';
import { useErrorToast } from '@/hooks/use-error-toast';
import { useSuccessToast } from '@/hooks/use-success-toast';
import { getReviewErrorMessage } from '@/utils/review-error';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { reviewSchema, type ReviewFormValues } from '../schema';
import { RatingInput } from './rating-input';

type Props = {
  sessionId: string;
  consultantId: string;
  tellerId: string;
};

// レビューの入力フォーム。投稿したら詳細画面へ戻る
export function ReviewForm({ sessionId, consultantId, tellerId }: Props) {
  const router = useRouter();
  const showError = useErrorToast();
  const showSuccess = useSuccessToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<ReviewFormValues>({
    resolver: zodResolver(reviewSchema),
    defaultValues: { rating: 0, comment: '' },
  });

  async function onSubmit({ rating, comment }: ReviewFormValues) {
    setIsSubmitting(true);

    const { error } = await createReview({
      sessionId,
      reviewerId: consultantId,
      revieweeId: tellerId,
      rating,
      comment,
    });
    if (error) {
      showError(getReviewErrorMessage(error));
      setIsSubmitting(false);
      return;
    }

    showSuccess('レビューを投稿しました');
    // 詳細画面まで戻る（詳細画面は表示されたときにレビューを読み直す）。
    // dismissTo を使う理由は、メッセージを書く画面と同じ（URL から直接開いたときに、タブへ戻らないようにする）
    router.dismissTo({ pathname: '/sessions/[id]', params: { id: sessionId } });
  }

  return (
    <VStack space="xl">
      <Controller
        control={control}
        name="rating"
        render={({ field: { value, onChange } }) => (
          <FormControl isInvalid={!!errors.rating}>
            <FormControlLabel>
              <FormControlLabelText>評価</FormControlLabelText>
            </FormControlLabel>
            <RatingInput value={value} onChange={onChange} />
            <FormControlError>
              <FormControlErrorText>{errors.rating?.message}</FormControlErrorText>
            </FormControlError>
          </FormControl>
        )}
      />

      <Controller
        control={control}
        name="comment"
        render={({ field: { value, onChange, onBlur } }) => (
          <FormControl isInvalid={!!errors.comment}>
            <FormControlLabel>
              <FormControlLabelText>コメント（任意）</FormControlLabelText>
            </FormControlLabel>
            <FilledTextarea className="h-40">
              <TextareaInput
                placeholder="良かったところや、感じたことを書いてください"
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                accessibilityLabel="コメント"
              />
            </FilledTextarea>
            <FormControlHelper>
              <FormControlHelperText>500文字まで</FormControlHelperText>
            </FormControlHelper>
            <FormControlError>
              <FormControlErrorText>{errors.comment?.message}</FormControlErrorText>
            </FormControlError>
          </FormControl>
        )}
      />

      <Button size="lg" onPress={handleSubmit(onSubmit)} isDisabled={isSubmitting}>
        {isSubmitting ? <ButtonSpinner /> : <ButtonText>投稿する</ButtonText>}
      </Button>
    </VStack>
  );
}
