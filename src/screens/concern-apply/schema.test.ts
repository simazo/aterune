import { concernApplySchema } from './schema';

function firstErrorMessage(values: unknown) {
  const result = concernApplySchema.safeParse(values);
  return result.success ? undefined : result.error.issues[0].message;
}

describe('concernApplySchema', () => {
  it('ひとことを入力していれば通る', () => {
    expect(concernApplySchema.safeParse({ message: 'よろしくお願いします' }).success).toBe(true);
  });

  it('ひとことは空でも通る', () => {
    expect(concernApplySchema.safeParse({ message: '' }).success).toBe(true);
  });

  it('ひとことがスペースだけなら空にして通す', () => {
    const result = concernApplySchema.safeParse({ message: '　 ' });

    expect(result.success && result.data.message).toBe('');
  });

  it('ひとことの前後のスペースは取り除かれる', () => {
    const result = concernApplySchema.safeParse({ message: ' よろしく　' });

    expect(result.success && result.data.message).toBe('よろしく');
  });

  it('ひとことが101文字ならエラー', () => {
    expect(firstErrorMessage({ message: 'あ'.repeat(101) })).toBe(
      'ひとことは100文字以内で入力してください'
    );
  });

  it('ひとことが100文字なら通る', () => {
    expect(concernApplySchema.safeParse({ message: 'あ'.repeat(100) }).success).toBe(true);
  });
});
