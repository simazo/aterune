import type { Gender } from '@/types';

type PrivateDetails = {
  birthdate: string | null;
  gender: Gender | null;
};

type PrivateDetailsInput = {
  // 'YYYY-MM-DD'。未選択・選び途中なら ''
  birthdate: string;
  gender: Gender | null;
};

// プロフィール編集の入力から、保存する生年月日・性別を決める。変わっていなければ null（保存しない）。
// 生年月日が空（未選択・選び途中）なら保存済みの値を残す（選び途中で保存して、登録済みの生年月日が消えないようにする）
export function getPrivateDetailsToSave(
  input: PrivateDetailsInput,
  saved: PrivateDetails
): PrivateDetails | null {
  const next = { birthdate: input.birthdate || saved.birthdate, gender: input.gender };
  if (next.birthdate === saved.birthdate && next.gender === saved.gender) return null;
  return next;
}
