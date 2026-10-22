import { reviewSchema } from './schema';

function firstErrorMessage(values: unknown) {
  const result = reviewSchema.safeParse(values);
  return result.success ? undefined : result.error.issues[0].message;
}

describe('reviewSchema', () => {
  it('評価を選んでいれば、コメントが空でも通る', () => {
    expect(reviewSchema.safeParse({ rating: 3, comment: '' }).success).toBe(true);
  });

  it('評価を選んでいない（0）ならエラー', () => {
    expect(firstErrorMessage({ rating: 0, comment: '' })).toBe('評価を選んでください');
  });

  it('評価が6ならエラー', () => {
    expect(firstErrorMessage({ rating: 6, comment: '' })).toBe('評価を選んでください');
  });

  it('評価が整数でなければエラー', () => {
    expect(firstErrorMessage({ rating: 2.5, comment: '' })).toBe('評価を選んでください');
  });

  it('コメントが501文字ならエラー', () => {
    expect(firstErrorMessage({ rating: 5, comment: 'あ'.repeat(501) })).toBe(
      'コメントは500文字以内で入力してください'
    );
  });

  it('コメントがちょうど500文字なら通る', () => {
    expect(reviewSchema.safeParse({ rating: 5, comment: 'あ'.repeat(500) }).success).toBe(true);
  });

  it('コメントの前後の空白を除く（空白だけなら空にする）', () => {
    expect(reviewSchema.parse({ rating: 5, comment: '  ありがとう\n' })).toEqual({
      rating: 5,
      comment: 'ありがとう',
    });
    expect(reviewSchema.parse({ rating: 5, comment: '　 \n' })).toEqual({ rating: 5, comment: '' });
  });
});
