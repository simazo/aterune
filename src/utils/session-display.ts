import type { Gender, Session } from '@/types';

const HOUR_MS = 60 * 60 * 1000;

// 承認待ちの残り時間（now の時点）。やり取りの一覧とセッション詳細で使う
export function formatRemaining(expiresAt: string, now: Date) {
  const hours = Math.floor((new Date(expiresAt).getTime() - now.getTime()) / HOUR_MS);
  return hours < 1 ? '残り1時間未満' : `残り${hours}時間`;
}

// 終了したセッションの結果の表示名。
// 期限切れの pending（DB の定期処理（最大10分おき）がまだ expired に変えていないもの）も、期限切れとして出す
export function getEndedLabel(status: Session['status']) {
  switch (status) {
    case 'completed':
    case 'auto_completed':
      return '完了';
    case 'rejected':
      return 'お見送り';
    default:
      return '期限切れ';
  }
}

// 性別の表示名（「回答しない」の null は呼び出し側で扱う）
export const GENDER_LABELS: Record<Gender, string> = {
  female: '女性',
  male: '男性',
  other: 'その他',
};

// 生年月日（'YYYY-MM-DD'）を「1995年4月12日（31歳）」の形にする。年齢は today の時点（端末の日付）
export function formatBirthdateWithAge(birthdate: string, today: Date) {
  const [year, month, day] = birthdate.split('-').map(Number);
  // 今年の誕生日がまだ来ていなければ1歳引く
  const hasHadBirthday =
    today.getMonth() + 1 > month || (today.getMonth() + 1 === month && today.getDate() >= day);
  const age = today.getFullYear() - year - (hasHadBirthday ? 0 : 1);
  return `${year}年${month}月${day}日（${age}歳）`;
}
