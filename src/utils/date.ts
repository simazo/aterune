// 年が未選択のときに2月の日数を数えるための、うるう年
const LEAP_YEAR = 2000;

const DATE_STRING_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

// 日の選択肢の上限（月は 1〜12）。
// 月が未選択なら 31、年が未選択ならその月にありうる最大の日数（2月は 29）
export function getMaxDay(year: number | null, month: number | null) {
  if (month === null) return 31;
  // Date の月は 0 始まりなので、翌月の 0 日目＝その月の末日になる
  return new Date(year ?? LEAP_YEAR, month, 0).getDate();
}

// 'YYYY-MM-DD' の形にする（DB の date 型と同じ形）
export function toDateString(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

// 'YYYY-MM-DD' を年・月・日に分ける。形式が違う・実在しない日付なら null
export function parseDateString(value: string) {
  const match = DATE_STRING_PATTERN.exec(value);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > getMaxDay(year, month)) return null;

  return { year, month, day };
}
