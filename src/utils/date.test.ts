import { getMaxDay, getTodayString, parseDateString, toDateString } from './date';

describe('getMaxDay', () => {
  it('月が未選択なら31を返す', () => {
    expect(getMaxDay(null, null)).toBe(31);
    expect(getMaxDay(2023, null)).toBe(31);
  });

  it('年が未選択で2月なら、うるう年もありうるので29を返す', () => {
    expect(getMaxDay(null, 2)).toBe(29);
  });

  it('年が未選択でも、2月以外はその月の日数を返す', () => {
    expect(getMaxDay(null, 4)).toBe(30);
    expect(getMaxDay(null, 12)).toBe(31);
  });

  it('うるう年の2月なら29を返す', () => {
    expect(getMaxDay(2024, 2)).toBe(29);
    expect(getMaxDay(2000, 2)).toBe(29);
  });

  it('うるう年でない年の2月なら28を返す', () => {
    expect(getMaxDay(2023, 2)).toBe(28);
    expect(getMaxDay(1900, 2)).toBe(28);
  });

  it('30日の月なら30を返す', () => {
    expect(getMaxDay(2023, 11)).toBe(30);
  });
});

describe('toDateString', () => {
  it('月と日を2桁にそろえてYYYY-MM-DDの形にする', () => {
    expect(toDateString(1990, 1, 5)).toBe('1990-01-05');
    expect(toDateString(2001, 12, 31)).toBe('2001-12-31');
  });
});

describe('parseDateString', () => {
  it('YYYY-MM-DDを年・月・日の数値に分ける', () => {
    expect(parseDateString('1990-01-05')).toEqual({ year: 1990, month: 1, day: 5 });
  });

  it('実在しない日付ならnullを返す', () => {
    expect(parseDateString('2023-02-29')).toBeNull();
    expect(parseDateString('2023-04-31')).toBeNull();
    expect(parseDateString('2023-13-01')).toBeNull();
    expect(parseDateString('2023-00-10')).toBeNull();
  });

  it('うるう年の2月29日は実在する日付として扱う', () => {
    expect(parseDateString('2024-02-29')).toEqual({ year: 2024, month: 2, day: 29 });
  });

  it('形式が違えばnullを返す', () => {
    expect(parseDateString('')).toBeNull();
    expect(parseDateString('1990/01/05')).toBeNull();
    expect(parseDateString('1990-1-5')).toBeNull();
  });
});

describe('getTodayString', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('端末の日付で今日を YYYY-MM-DD にする', () => {
    jest.useFakeTimers({ now: new Date(2026, 0, 5, 23, 59, 0) });

    expect(getTodayString()).toBe('2026-01-05');
  });
});
