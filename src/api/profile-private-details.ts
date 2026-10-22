import { supabase } from '@/lib/supabase';
import type { Gender } from '@/types';

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

type PrivateDetails = {
  birthdate: string | null;
  gender: Gender | null;
};

// 自分の生年月日（'YYYY-MM-DD'）と性別を取得する（プロフィール編集の初期値）。行が無ければ data は null
export async function getMyPrivateDetails(userId: string) {
  const { data, error } = await supabase
    .from('profile_private_details')
    .select('birthdate, gender')
    .eq('profile_id', userId)
    .maybeSingle();

  // gender は CHECK 制約で Gender の値か null に限られるが、型生成では string になるため上書きする
  return { data: data as PrivateDetails | null, error };
}

// セッションの相談者の生年月日と性別を取得する（占い師がセッション詳細で見る）。
// 読めるかどうかは RLS（profile_private_details_select_teller_of_session）が決め、
// 占い師から応募して未承認の申込み・拒否・期限切れでは行が返らず data は null になる
export async function getConsultantPrivateDetails(consultantId: string) {
  const { data, error } = await supabase
    .from('profile_private_details')
    .select('birthdate, gender')
    .eq('profile_id', consultantId)
    .maybeSingle();

  // 上書きの理由は getMyPrivateDetails と同じ
  return { data: data as PrivateDetails | null, error };
}

// 自分の生年月日と性別を保存する。null は未入力（性別は「回答しない」）。
// 行が無いときの扱いと、同時に保存したときの注意は saveMyBirthdate と同じ
export async function saveMyPrivateDetails(userId: string, { birthdate, gender }: PrivateDetails) {
  const { data, error } = await supabase
    .from('profile_private_details')
    .update({ birthdate, gender })
    .eq('profile_id', userId)
    .select('profile_id');

  if (error) return { error };
  if (data.length > 0) return { error: null };

  const { error: insertError } = await supabase
    .from('profile_private_details')
    .insert({ profile_id: userId, birthdate, gender });

  return { error: insertError };
}
