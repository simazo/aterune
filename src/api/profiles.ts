import { supabase } from '@/lib/supabase';

type UpdateMyProfileParams = {
  displayName: string;
  bio: string;
};

// 自分のプロフィール（マイページ・プロフィール編集の表示用）を取得する
export async function getMyProfile(userId: string) {
  return supabase
    .from('profiles')
    .select('display_name, bio, avatar_url, is_teller')
    .eq('id', userId)
    .single();
}

// 自分の表示名と自己紹介を更新する。自己紹介が空なら null（未入力）で保存する。
// 空白だけの表示名・文字数の超過は DB の CHECK が弾く
export async function updateMyProfile(userId: string, { displayName, bio }: UpdateMyProfileParams) {
  const { error } = await supabase
    .from('profiles')
    .update({ display_name: displayName, bio: bio || null })
    .eq('id', userId);

  return { error };
}
