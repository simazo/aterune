import { reportSchema } from './schema';

function firstErrorMessage(values: unknown) {
  const result = reportSchema.safeParse(values);
  return result.success ? undefined : result.error.issues[0].message;
}

describe('reportSchema', () => {
  it('理由を選んでいれば、詳しい内容が空でも通る', () => {
    expect(reportSchema.safeParse({ reason: 'spam', detail: '' }).success).toBe(true);
  });

  it('理由を選んでいなければエラー', () => {
    expect(firstErrorMessage({ reason: undefined, detail: '' })).toBe('理由を選んでください');
  });

  it('決めた値でない理由ならエラー', () => {
    expect(firstErrorMessage({ reason: 'unknown', detail: '' })).toBe('理由を選んでください');
  });

  it('詳しい内容が501文字ならエラー', () => {
    expect(firstErrorMessage({ reason: 'other', detail: 'あ'.repeat(501) })).toBe(
      '詳しい内容は500文字以内で入力してください'
    );
  });

  it('詳しい内容がちょうど500文字なら通る', () => {
    expect(reportSchema.safeParse({ reason: 'other', detail: 'あ'.repeat(500) }).success).toBe(
      true
    );
  });

  it('詳しい内容の前後の空白を除く（空白だけなら空にする）', () => {
    expect(reportSchema.parse({ reason: 'harassment', detail: '  暴言があった\n' })).toEqual({
      reason: 'harassment',
      detail: '暴言があった',
    });
    expect(reportSchema.parse({ reason: 'harassment', detail: '　 \n' })).toEqual({
      reason: 'harassment',
      detail: '',
    });
  });
});
