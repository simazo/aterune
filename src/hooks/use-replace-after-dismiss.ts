import { useRouter, type Href } from 'expo-router';
import { useCallback } from 'react';

// どちらのグループにも入らない画面（/auth/confirmed など）から別の画面へ移るときに使う。
// メールのリンクで開くと、これらの画面はルートの Stack でログイン画面の上に重なるため、
// そのまま replace すると、戻るボタン（Android など）で下のログイン画面へ戻れてしまう。
// 先にルートの Stack の履歴を消してから移る
export function useReplaceAfterDismiss() {
  const router = useRouter();

  return useCallback(
    (href: Href) => {
      // 直接開いて下に画面が無いときに dismissAll を呼ぶと、処理されない操作として開発時に警告が出る
      if (router.canDismiss()) {
        router.dismissAll();
      }
      router.replace(href);
    },
    [router]
  );
}
