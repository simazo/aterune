import { deleteAvatar, getAvatarUrl, uploadAvatar } from '@/api/avatars';
import { CameraIcon } from '@/components/icons';
import {
  Actionsheet,
  ActionsheetBackdrop,
  ActionsheetContent,
  ActionsheetDragIndicator,
  ActionsheetDragIndicatorWrapper,
  ActionsheetItem,
  ActionsheetItemText,
} from '@/components/ui/actionsheet';
import { Avatar, AvatarFallbackText, AvatarImage } from '@/components/ui/avatar';
import { Icon } from '@/components/ui/icon';
import { Pressable } from '@/components/ui/pressable';
import { Spinner } from '@/components/ui/spinner';
import { VStack } from '@/components/ui/vstack';
import { useErrorToast } from '@/hooks/use-error-toast';
import { pickAvatarImage } from '@/lib/avatar-image';
import { logger } from '@/lib/logger';
import { useState } from 'react';

type Props = {
  userId: string;
  displayName: string;
  // 保存済みのアイコンのパス。未設定なら null
  avatarPath: string | null;
};

// プロフィール編集の上部のアイコン。タップして画像を選ぶとすぐ保存する（フォームの「保存」とは別）。
// 画像があるときは、選び直すか削除するかを下からのメニューで選ぶ
export function AvatarEditor({ userId, displayName, avatarPath: savedAvatarPath }: Props) {
  const showError = useErrorToast();
  // 保存したら新しいパスに差し替え、古いファイルの削除や次の差し替えに使う
  const [avatarPath, setAvatarPath] = useState(savedAvatarPath);
  const [isSaving, setIsSaving] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // Web はボタンを押した直後でないとファイル選択が開かないため、押したときの処理から直接呼ぶ
  const handlePick = async () => {
    setIsMenuOpen(false);

    let image: ArrayBuffer | null;
    try {
      image = await pickAvatarImage();
    } catch (e) {
      logger.warn('アイコンの画像の読み込みエラー:', e instanceof Error ? e.message : e);
      showError('画像を読み込めませんでした');
      return;
    }
    // 選択・切り抜きの途中でキャンセルしたら何もしない
    if (!image) return;

    setIsSaving(true);
    const { path, error } = await uploadAvatar(userId, image, avatarPath);
    setIsSaving(false);

    if (error) {
      showError('アイコンを保存できませんでした');
      return;
    }
    setAvatarPath(path);
  };

  const handleDelete = async () => {
    setIsMenuOpen(false);
    if (!avatarPath) return;

    setIsSaving(true);
    const { error } = await deleteAvatar(userId, avatarPath);
    setIsSaving(false);

    if (error) {
      showError('アイコンを削除できませんでした');
      return;
    }
    setAvatarPath(null);
  };

  const handlePressAvatar = () => {
    if (avatarPath) {
      setIsMenuOpen(true);
    } else {
      handlePick();
    }
  };

  return (
    <>
      <Pressable
        onPress={handlePressAvatar}
        disabled={isSaving}
        accessibilityRole="button"
        accessibilityLabel="アイコンを変更する"
        className="relative self-center"
      >
        <Avatar size="lg">
          <AvatarFallbackText>{displayName}</AvatarFallbackText>
          {avatarPath && <AvatarImage source={{ uri: getAvatarUrl(avatarPath) }} />}
        </Avatar>
        {isSaving && (
          <VStack className="absolute inset-0 items-center justify-center rounded-full bg-black/40">
            <Spinner className="text-white" />
          </VStack>
        )}
        {/* タップしてアイコンを変えられることが分かるよう、右下にカメラのマークを付ける */}
        <VStack className="absolute -bottom-1 -right-1 h-7 w-7 items-center justify-center rounded-full border-2 border-background bg-primary">
          <Icon as={CameraIcon} size="xs" className="text-primary-foreground" />
        </VStack>
      </Pressable>

      <Actionsheet isOpen={isMenuOpen} onClose={() => setIsMenuOpen(false)}>
        <ActionsheetBackdrop />
        <ActionsheetContent>
          <ActionsheetDragIndicatorWrapper>
            <ActionsheetDragIndicator />
          </ActionsheetDragIndicatorWrapper>
          <ActionsheetItem onPress={handlePick}>
            <ActionsheetItemText>画像を選ぶ</ActionsheetItemText>
          </ActionsheetItem>
          {/* 確認は出さず、すぐ削除して頭文字の表示に戻す */}
          <ActionsheetItem onPress={handleDelete}>
            <ActionsheetItemText className="text-destructive">削除</ActionsheetItemText>
          </ActionsheetItem>
          <ActionsheetItem onPress={() => setIsMenuOpen(false)}>
            <ActionsheetItemText>キャンセル</ActionsheetItemText>
          </ActionsheetItem>
        </ActionsheetContent>
      </Actionsheet>
    </>
  );
}
