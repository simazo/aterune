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
  title: string;
  description: string;
  confirmLabel: string;
  // 取り消せない操作（拒否など）は destructive にして目立たせる
  confirmVariant?: 'default' | 'destructive';
  isSubmitting: boolean;
  onClose: () => void;
  onConfirm: () => void;
};

// 元に戻せない操作（申込みの拒否・セッションの完了）の前の確認。押し間違いを防ぐ
export function ConfirmDialog({
  isOpen,
  title,
  description,
  confirmLabel,
  confirmVariant = 'default',
  isSubmitting,
  onClose,
  onConfirm,
}: Props) {
  return (
    <AlertDialog isOpen={isOpen} onClose={onClose} size="md">
      <AlertDialogBackdrop />
      {/* ライトの背景色（bg-background）は色付きなので、カードと同じ背景にする */}
      <AlertDialogContent className="bg-card">
        <AlertDialogHeader>
          <Heading size="md">{title}</Heading>
        </AlertDialogHeader>
        <AlertDialogBody className="mb-4 mt-3">
          <Text size="sm">{description}</Text>
        </AlertDialogBody>
        <AlertDialogFooter>
          <Button variant="outline" className="bg-card" onPress={onClose} isDisabled={isSubmitting}>
            <ButtonText>やめる</ButtonText>
          </Button>
          <Button variant={confirmVariant} onPress={onConfirm} isDisabled={isSubmitting}>
            {isSubmitting && <ButtonSpinner />}
            <ButtonText>{confirmLabel}</ButtonText>
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
