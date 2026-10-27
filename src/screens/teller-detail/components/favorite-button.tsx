import { addFavorite, isFavoriteTeller, removeFavorite } from '@/api/favorites';
import { FavouriteIcon, Icon } from '@/components/ui/icon';
import { Pressable } from '@/components/ui/pressable';
import { useErrorToast } from '@/hooks/use-error-toast';
import { logger } from '@/lib/logger';
import { useEffect, useState } from 'react';

type Props = {
  userId: string;
  tellerId: string;
};

// 占い師詳細のヘッダー右端に置く、お気に入りの登録・解除のボタン（登録済みならハートを塗る）。
// 登録状態を確かめ終わるまでと、確かめられなかったときは出さない
// （実際と違う状態を出すと、押したときに逆の操作になるため）
export function FavoriteButton({ userId, tellerId }: Props) {
  const showError = useErrorToast();
  const [isFavorite, setIsFavorite] = useState<boolean | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    // 別の占い師の画面へ素早く切り替えたとき、古い結果で上書きしないようにする
    let isCancelled = false;

    (async () => {
      setIsFavorite(null);
      const { data, error } = await isFavoriteTeller(userId, tellerId);
      if (isCancelled) return;
      if (error) {
        logger.warn('お気に入りの登録状態の取得エラー:', error.message);
        return;
      }
      setIsFavorite(data);
    })();

    return () => {
      isCancelled = true;
    };
  }, [userId, tellerId]);

  if (isFavorite === null) return null;

  async function handlePress() {
    setIsSaving(true);
    const { error } = isFavorite
      ? await removeFavorite(userId, tellerId)
      : await addFavorite(userId, tellerId);
    if (error) {
      showError(isFavorite ? 'お気に入りから外せませんでした' : 'お気に入りに登録できませんでした');
    } else {
      setIsFavorite(!isFavorite);
    }
    setIsSaving(false);
  }

  return (
    <Pressable
      onPress={handlePress}
      disabled={isSaving}
      accessibilityRole="button"
      accessibilityLabel={isFavorite ? 'お気に入りから外す' : 'お気に入りに登録'}
      accessibilityState={{ selected: isFavorite, disabled: isSaving }}
      className="mr-4 p-1 data-[active=true]:opacity-60"
    >
      <Icon
        as={FavouriteIcon}
        size="xl"
        className={isFavorite ? 'fill-primary text-primary' : 'text-foreground'}
      />
    </Pressable>
  );
}
