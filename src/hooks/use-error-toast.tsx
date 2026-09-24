import { Toast, ToastDescription, useToast } from '@/components/ui/toast';

export function useErrorToast() {
  const toast = useToast();

  return function showError(message: string) {
    toast.show({
      placement: 'top',
      render: ({ id }) => (
        <Toast nativeID={`toast-${id}`} action="error" variant="solid">
          <ToastDescription>{message}</ToastDescription>
        </Toast>
      ),
    });
  };
}
