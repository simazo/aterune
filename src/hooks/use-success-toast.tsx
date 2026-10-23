import { Toast, ToastDescription, useToast } from '@/components/ui/toast';
import { useCallback } from 'react';

// 操作の完了（申込みの送信など）を知らせる Toast。
// useErrorToast と同じく、描画をまたいで変わらない show だけを使い、showSuccess を固定する
export function useSuccessToast() {
  const { show } = useToast();

  return useCallback(
    (message: string) => {
      show({
        placement: 'top',
        render: ({ id }) => (
          <Toast nativeID={`toast-${id}`} action="success" variant="solid">
            <ToastDescription>{message}</ToastDescription>
          </Toast>
        ),
      });
    },
    [show]
  );
}
