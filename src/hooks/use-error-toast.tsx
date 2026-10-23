import { Toast, ToastDescription, useToast } from '@/components/ui/toast';
import { useCallback } from 'react';

// 失敗（読み込み・保存のエラーなど）を知らせる Toast。
// showError は描画をまたいで同じ関数なので、useEffect などの依存配列に入れてよい。
// useToast() の戻り値は Toast を出すたびに作り直されるため、変わらない show だけを使う
// （戻り値ごと依存にすると、読み込みに失敗して Toast を出す → showError が変わる → 読み込み直す、を繰り返す）
export function useErrorToast() {
  const { show } = useToast();

  return useCallback(
    (message: string) => {
      show({
        placement: 'top',
        render: ({ id }) => (
          <Toast nativeID={`toast-${id}`} action="error" variant="solid">
            <ToastDescription>{message}</ToastDescription>
          </Toast>
        ),
      });
    },
    [show]
  );
}
