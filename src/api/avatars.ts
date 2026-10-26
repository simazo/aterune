import { logger } from '@/lib/logger';
import { supabase } from '@/lib/supabase';

// アイコン画像を置く Storage のバケット（公開バケット。ファイルは <ユーザーの id>/<ファイル名>.jpg）
const AVATARS_BUCKET = 'avatars';

// パスからアイコンの公開 URL を作る（通信はしない）
export function getAvatarUrl(path: string) {
  return supabase.storage.from(AVATARS_BUCKET).getPublicUrl(path).data.publicUrl;
}

// 消しそこねても表示には影響しない（どこからも参照されないファイルが残るだけ）ので、失敗はログだけにする
async function removeAvatarFile(path: string) {
  const { error } = await supabase.storage.from(AVATARS_BUCKET).remove([path]);

  if (error) {
    logger.warn('アイコンのファイルの削除エラー:', error.message);
  }
}

// 縮小済みの JPEG をアップロードし、自分のアイコンにする。
// 端末の画像キャッシュに古い画像が残らないよう、上書きせず毎回新しいファイル名で上げ、保存できたら古いファイルを消す
export async function uploadAvatar(userId: string, image: ArrayBuffer, currentPath: string | null) {
  const path = `${userId}/${Date.now()}.jpg`;

  const { error: uploadError } = await supabase.storage
    .from(AVATARS_BUCKET)
    .upload(path, image, { contentType: 'image/jpeg', upsert: false });

  if (uploadError) {
    return { path: null, error: uploadError };
  }

  const { error: updateError } = await supabase
    .from('profiles')
    .update({ avatar_path: path })
    .eq('id', userId);

  if (updateError) {
    // どこからも参照されないファイルを残さないよう、今上げたファイルを消す
    await removeAvatarFile(path);
    return { path: null, error: updateError };
  }

  if (currentPath) {
    await removeAvatarFile(currentPath);
  }

  return { path, error: null };
}

// 自分のアイコンを未設定（頭文字の表示）に戻す。
// 先にファイルを消すと、更新に失敗したときにプロフィールが消えたファイルを指してしまうので、更新を先にする
export async function deleteAvatar(userId: string, currentPath: string) {
  const { error } = await supabase
    .from('profiles')
    .update({ avatar_path: null })
    .eq('id', userId);

  if (error) {
    return { error };
  }

  await removeAvatarFile(currentPath);

  return { error: null };
}
