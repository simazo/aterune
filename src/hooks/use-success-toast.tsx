import { Toast, ToastDescription, useToast } from '@/components/ui/toast';

// 操作の完了（申込みの送信など）を知らせる Toast
export function useSuccessToast() {
  const toast = useToast();

  return function showSuccess(message: string) {
    toast.show({
      placement: 'top',
      render: ({ id }) => (
        <Toast nativeID={`toast-${id}`} action="success" variant="solid">
          <ToastDescription>{message}</ToastDescription>
        </Toast>
      ),
    });
  };
}
