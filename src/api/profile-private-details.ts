import { supabase } from '@/lib/supabase';

// 自分の生年月日（'YYYY-MM-DD'）を取得する。行が無い・未入力なら data は null
export async function getMyBirthdate(userId: string) {
  const { data, error } = await supabase
    .from('profile_private_details')
    .select('birthdate')
    .eq('profile_id', userId)
    .maybeSingle();

  return { data: data?.birthdate ?? null, error };
}

// 自分の生年月日（'YYYY-MM-DD'）を保存する。
// upsert は既存の行の profile_id まで更新しようとし、profile_id には update 権限が無いため失敗する。
// そのため、まず更新し、自分の行がまだ無ければ作る。
// 行が無い状態で同時に保存すると（2端末からなど）、後の insert が主キー重複でエラーになるが、値は先の保存で入っている
export async function saveMyBirthdate(userId: string, birthdate: string) {
  const { data, error } = await supabase
    .from('profile_private_details')
    .update({ birthdate })
    .eq('profile_id', userId)
    .select('profile_id');

  if (error) return { error };
  if (data.length > 0) return { error: null };

  const { error: insertError } = await supabase
    .from('profile_private_details')
    .insert({ profile_id: userId, birthdate });

  return { error: insertError };
}
