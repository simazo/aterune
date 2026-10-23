import { concernNewSchema } from './schema';

const validValues = {
  concernTagId: 'tag-1',
  concern: '仕事の悩みを聞いてほしいです',
};

function firstErrorMessage(values: unknown) {
  const result = concernNewSchema.safeParse(values);
  return result.success ? undefined : result.error.issues[0].message;
}

describe('concernNewSchema', () => {
  it('すべて正しく入力されていれば通る', () => {
    expect(concernNewSchema.safeParse(validValues).success).toBe(true);
  });

  it('悩みの種類が未選択ならエラー', () => {
    expect(firstErrorMessage({ ...validValues, concernTagId: '' })).toBe(
      '悩みの種類を選んでください'
    );
  });

  it('お悩みの内容が空ならエラー', () => {
    expect(firstErrorMessage({ ...validValues, concern: '' })).toBe(
      'お悩みの内容を入力してください'
    );
  });

  it('お悩みの内容がスペースだけならエラー', () => {
    expect(firstErrorMessage({ ...validValues, concern: '　 ' })).toBe(
      'お悩みの内容を入力してください'
    );
  });

  it('お悩みの内容が1001文字ならエラー', () => {
    expect(firstErrorMessage({ ...validValues, concern: 'あ'.repeat(1001) })).toBe(
      'お悩みの内容は1000文字以内で入力してください'
    );
  });

  it('お悩みの内容が1000文字なら通る', () => {
    const values = { ...validValues, concern: 'あ'.repeat(1000) };
    expect(concernNewSchema.safeParse(values).success).toBe(true);
  });

  it('お悩みの内容の前後のスペースは取り除かれる', () => {
    const result = concernNewSchema.safeParse({ ...validValues, concern: ' 仕事の悩み　' });

    expect(result.success && result.data.concern).toBe('仕事の悩み');
  });
});
