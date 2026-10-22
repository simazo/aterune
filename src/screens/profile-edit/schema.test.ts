import { profileEditSchema } from './schema';

const validValues = {
  displayName: 'テストユーザー',
  bio: 'よろしくお願いします',
  birthdate: '1990-01-05',
  gender: 'female',
};

function firstErrorMessage(values: unknown) {
  const result = profileEditSchema.safeParse(values);
  return result.success ? undefined : result.error.issues[0].message;
}

beforeEach(() => {
  // 「未来の日付」の判定のため、今日を 2026-10-20 に固定する
  jest.useFakeTimers({ now: new Date(2026, 9, 20, 12, 0, 0) });
});

afterEach(() => {
  jest.useRealTimers();
});

describe('profileEditSchema', () => {
  it('すべて正しく入力されていれば通る', () => {
    expect(profileEditSchema.safeParse(validValues).success).toBe(true);
  });

  it('表示名が空ならエラー', () => {
    expect(firstErrorMessage({ ...validValues, displayName: '' })).toBe('表示名を入力してください');
  });

  it('表示名がスペースだけならエラー', () => {
    expect(firstErrorMessage({ ...validValues, displayName: '　 ' })).toBe(
      '表示名を入力してください'
    );
  });

  it('表示名が21文字ならエラー', () => {
    expect(firstErrorMessage({ ...validValues, displayName: 'あ'.repeat(21) })).toBe(
      '表示名は20文字以内で入力してください'
    );
  });

  it('表示名が20文字なら通る', () => {
    expect(
      profileEditSchema.safeParse({ ...validValues, displayName: 'あ'.repeat(20) }).success
    ).toBe(true);
  });

  it('表示名と自己紹介の前後のスペースは取り除かれる', () => {
    const result = profileEditSchema.safeParse({
      ...validValues,
      displayName: ' テストユーザー ',
      bio: '　よろしく　',
    });

    expect(result.success && result.data).toMatchObject({
      displayName: 'テストユーザー',
      bio: 'よろしく',
    });
  });

  it('自己紹介は空でも通る', () => {
    expect(profileEditSchema.safeParse({ ...validValues, bio: '' }).success).toBe(true);
  });

  it('自己紹介が201文字ならエラー', () => {
    expect(firstErrorMessage({ ...validValues, bio: 'あ'.repeat(201) })).toBe(
      '自己紹介は200文字以内で入力してください'
    );
  });

  it('自己紹介が200文字なら通る', () => {
    expect(profileEditSchema.safeParse({ ...validValues, bio: 'あ'.repeat(200) }).success).toBe(
      true
    );
  });

  it('生年月日が未選択（空）でも通る', () => {
    expect(profileEditSchema.safeParse({ ...validValues, birthdate: '' }).success).toBe(true);
  });

  it('生年月日が実在しない日付ならエラー', () => {
    expect(firstErrorMessage({ ...validValues, birthdate: '2023-02-29' })).toBe(
      '正しい日付を選択してください'
    );
  });

  it('生年月日が明日ならエラー', () => {
    expect(firstErrorMessage({ ...validValues, birthdate: '2026-10-21' })).toBe(
      '未来の日付は選択できません'
    );
  });

  it('生年月日が今日なら通る', () => {
    expect(profileEditSchema.safeParse({ ...validValues, birthdate: '2026-10-20' }).success).toBe(
      true
    );
  });

  it.each(['female', 'male', 'other', null])('性別が %s なら通る', (gender) => {
    expect(profileEditSchema.safeParse({ ...validValues, gender }).success).toBe(true);
  });

  it('性別が決まった値以外ならエラー', () => {
    expect(profileEditSchema.safeParse({ ...validValues, gender: 'unknown' }).success).toBe(false);
  });
});
