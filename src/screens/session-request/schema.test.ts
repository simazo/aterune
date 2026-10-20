import { buildSessionRequestSchema } from './schema';

const validValues = {
  concern: '仕事の悩みを相談したいです',
  message: 'よろしくお願いします',
  birthdate: '1990-01-05',
};

function firstErrorMessage(requiresBirthdate: boolean, values: unknown) {
  const result = buildSessionRequestSchema(requiresBirthdate).safeParse(values);
  return result.success ? undefined : result.error.issues[0].message;
}

beforeEach(() => {
  // 「未来の日付」の判定のため、今日を 2026-10-20 に固定する
  jest.useFakeTimers({ now: new Date(2026, 9, 20, 12, 0, 0) });
});

afterEach(() => {
  jest.useRealTimers();
});

describe('buildSessionRequestSchema', () => {
  it('すべて正しく入力されていれば通る', () => {
    expect(buildSessionRequestSchema(true).safeParse(validValues).success).toBe(true);
  });

  it('相談内容が空ならエラー', () => {
    expect(firstErrorMessage(false, { ...validValues, concern: '' })).toBe(
      '相談内容を入力してください'
    );
  });

  it('相談内容がスペースだけならエラー', () => {
    expect(firstErrorMessage(false, { ...validValues, concern: '　 ' })).toBe(
      '相談内容を入力してください'
    );
  });

  it('相談内容が1001文字ならエラー', () => {
    expect(firstErrorMessage(false, { ...validValues, concern: 'あ'.repeat(1001) })).toBe(
      '相談内容は1000文字以内で入力してください'
    );
  });

  it('相談内容が1000文字なら通る', () => {
    const values = { ...validValues, concern: 'あ'.repeat(1000) };
    expect(buildSessionRequestSchema(false).safeParse(values).success).toBe(true);
  });

  it('相談内容とひとことの前後のスペースは取り除かれる', () => {
    const result = buildSessionRequestSchema(false).safeParse({
      ...validValues,
      concern: ' 仕事の悩み ',
      message: '　よろしく　',
    });

    expect(result.success && result.data.concern).toBe('仕事の悩み');
    expect(result.success && result.data.message).toBe('よろしく');
  });

  it('ひとことは空でも通る', () => {
    const values = { ...validValues, message: '' };
    expect(buildSessionRequestSchema(false).safeParse(values).success).toBe(true);
  });

  it('ひとことがスペースだけなら空にして通す', () => {
    const result = buildSessionRequestSchema(false).safeParse({ ...validValues, message: '  ' });

    expect(result.success && result.data.message).toBe('');
  });

  it('ひとことが101文字ならエラー', () => {
    expect(firstErrorMessage(false, { ...validValues, message: 'あ'.repeat(101) })).toBe(
      'ひとことは100文字以内で入力してください'
    );
  });

  it('ひとことが100文字なら通る', () => {
    const values = { ...validValues, message: 'あ'.repeat(100) };
    expect(buildSessionRequestSchema(false).safeParse(values).success).toBe(true);
  });

  it('生年月日が必要な占い師で、生年月日が未選択ならエラー', () => {
    expect(firstErrorMessage(true, { ...validValues, birthdate: '' })).toBe(
      '生年月日を選択してください'
    );
  });

  it('生年月日が実在しない日付ならエラー', () => {
    expect(firstErrorMessage(true, { ...validValues, birthdate: '2023-02-29' })).toBe(
      '正しい日付を選択してください'
    );
  });

  it('生年月日が明日ならエラー', () => {
    expect(firstErrorMessage(true, { ...validValues, birthdate: '2026-10-21' })).toBe(
      '未来の日付は選択できません'
    );
  });

  it('生年月日が今日なら通る', () => {
    const values = { ...validValues, birthdate: '2026-10-20' };
    expect(buildSessionRequestSchema(true).safeParse(values).success).toBe(true);
  });

  it('生年月日が不要な占い師なら、生年月日が未選択でも通る', () => {
    const values = { ...validValues, birthdate: '' };
    expect(buildSessionRequestSchema(false).safeParse(values).success).toBe(true);
  });
});
