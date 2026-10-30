import { blockUser } from '@/api/blocks';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { Link, LinkText } from '@/components/ui/link';
import { useErrorToast } from '@/hooks/use-error-toast';
import { useSuccessToast } from '@/hooks/use-success-toast';
import { useState } from 'react';

type Props = {
  userId: string;
  otherUserId: string;
  otherUserName: string;
  // ブロックできたあとの画面ごとの動き（表示の切り替え・前の画面に戻るなど）
  onBlocked: () => void;
};

// 相手をブロックするリンク（セッション詳細・占い師詳細の下端に置く）。確認のダイアログを出してからブロックする。
// 押し間違えないよう、ボタンではなく目立たないリンクにする（マイページの「退会する」と同じ）
export function BlockUserLink({ userId, otherUserId, otherUserName, onBlocked }: Props) {
  const showError = useErrorToast();
  const showSuccess = useSuccessToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isBlocking, setIsBlocking] = useState(false);

  async function handleBlock() {
    setIsBlocking(true);
    const { error } = await blockUser(userId, otherUserId);
    setIsBlocking(false);
    if (error) {
      showError('ブロックできませんでした。時間をおいて、もう一度お試しください');
      return;
    }
    setIsDialogOpen(false);
    showSuccess(`${otherUserName}さんをブロックしました`);
    onBlocked();
  }

  return (
    <>
      <Link onPress={() => setIsDialogOpen(true)} className="self-center">
        <LinkText size="sm" className="text-muted-foreground">
          この相手をブロックする
        </LinkText>
      </Link>
      <ConfirmDialog
        isOpen={isDialogOpen}
        title={`${otherUserName}さんをブロックしますか？`}
        description="ブロックすると、お互いに申込み・お悩みへの応募ができなくなり、占い師の検索やお悩み一覧にも表示されなくなります。相手には知らされません。進行中のやり取りはそのまま続きます。解除はマイページからできます。"
        confirmLabel="ブロックする"
        confirmVariant="destructive"
        isSubmitting={isBlocking}
        onClose={() => setIsDialogOpen(false)}
        onConfirm={handleBlock}
      />
    </>
  );
}
