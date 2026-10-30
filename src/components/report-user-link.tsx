import { Link, LinkText } from '@/components/ui/link';
import { useRouter } from 'expo-router';

type Props = {
  otherUserId: string;
  otherUserName: string;
  // セッション詳細から通報するときのセッションID。占い師詳細からなら null
  sessionId: string | null;
};

// 相手を通報する画面へ移るリンク（セッション詳細・占い師詳細の下端に、ブロックのリンクと並べて置く）。
// ブロックのリンクと同じく、押し間違えないよう目立たないリンクにする
export function ReportUserLink({ otherUserId, otherUserName, sessionId }: Props) {
  const router = useRouter();

  function handlePress() {
    router.push({
      pathname: '/report',
      params: {
        userId: otherUserId,
        userName: otherUserName,
        ...(sessionId ? { sessionId } : {}),
      },
    });
  }

  return (
    <Link onPress={handlePress} className="self-center">
      <LinkText size="sm" className="text-muted-foreground">
        この相手を通報する
      </LinkText>
    </Link>
  );
}
