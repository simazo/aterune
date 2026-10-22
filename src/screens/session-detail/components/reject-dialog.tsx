import {
  AlertDialog,
  AlertDialogBackdrop,
  AlertDialogBody,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
} from '@/components/ui/alert-dialog';
import { Button, ButtonSpinner, ButtonText } from '@/components/ui/button';
import { Heading } from '@/components/ui/heading';
import { Text } from '@/components/ui/text';

type Props = {
  isOpen: boolean;
  isSubmitting: boolean;
  onClose: () => void;
  onConfirm: () => void;
};

// 申込みを拒否する前の確認。拒否は取り消せないため、押し間違いを防ぐ
export function RejectDialog({ isOpen, isSubmitting, onClose, onConfirm }: Props) {
  return (
    <AlertDialog isOpen={isOpen} onClose={onClose} size="md">
      <AlertDialogBackdrop />
      {/* ライトの背景色（bg-background）は色付きなので、カードと同じ背景にする */}
      <AlertDialogContent className="bg-card">
        <AlertDialogHeader>
          <Heading size="md">この申込みをお断りしますか？</Heading>
        </AlertDialogHeader>
        <AlertDialogBody className="mb-4 mt-3">
          <Text size="sm">お断りすると元に戻せません。相手には結果が通知されます。</Text>
        </AlertDialogBody>
        <AlertDialogFooter>
          <Button variant="outline" className="bg-card" onPress={onClose} isDisabled={isSubmitting}>
            <ButtonText>やめる</ButtonText>
          </Button>
          <Button variant="destructive" onPress={onConfirm} isDisabled={isSubmitting}>
            {isSubmitting && <ButtonSpinner />}
            <ButtonText>お断りする</ButtonText>
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
