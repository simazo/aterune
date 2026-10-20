import type { TagCategory } from '@/types';

// 完了したセッションがこの回数未満の占い師を「新人」として表示する
export const NEWCOMER_SESSION_THRESHOLD = 5;

export function isNewcomer(sessionCount: number) {
  return sessionCount < NEWCOMER_SESSION_THRESHOLD;
}

// タグの種類の表示名。画面ではこのキーの順に並べる（search_tellers / get_teller が返すタグの並びと合わせる）
export const CATEGORY_LABELS: Record<TagCategory, string> = {
  divination: '占術',
  concern: '相談内容',
  style: '回答のスタイル',
};

// 占い師のカード・詳細画面の上部の帯の色。占い師ごとに固定の1色を選ぶ（Tailwind が拾えるようクラス名は省略せずに書く）。
// ダークでは淡い色が浮いてまぶしいため、同じ色味の暗い色を半透明にしてカードの色になじませる
const ACCENT_CLASSES = [
  'bg-violet-200 dark:bg-violet-800/40',
  'bg-pink-200 dark:bg-pink-800/40',
  'bg-emerald-200 dark:bg-emerald-800/40',
  'bg-amber-200 dark:bg-amber-800/40',
  'bg-sky-200 dark:bg-sky-800/40',
];

export function getAccentClass(tellerId: string) {
  let sum = 0;
  for (const char of tellerId) {
    sum += char.charCodeAt(0);
  }
  return ACCENT_CLASSES[sum % ACCENT_CLASSES.length];
}
