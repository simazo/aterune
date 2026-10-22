import { tellerProfileEditSchema } from './schema';

const validValues = {
  divinationTagIds: ['tag-tarot'],
  concernTagIds: ['tag-love'],
  styleTagIds: ['tag-gentle'],
  selfPr: 'タロットで優しく寄り添います',
  trainingPeriod: '半年',
  isAccepting: true,
  requiresBirthdate: false,
};

function firstErrorMessage(values: unknown) {
  const result = tellerProfileEditSchema.safeParse(values);
  return result.success ? undefined : result.error.issues[0].message;
}

describe('tellerProfileEditSchema', () => {
  it('すべて正しく入力されていれば通る', () => {
    expect(tellerProfileEditSchema.safeParse(validValues).success).toBe(true);
  });

  it('占術を1つも選んでいなければエラー', () => {
    expect(firstErrorMessage({ ...validValues, divinationTagIds: [] })).toBe(
      '占術を1つ以上選んでください'
    );
  });

  it('得意な相談内容・回答のスタイルは選ばなくても通る', () => {
    expect(
      tellerProfileEditSchema.safeParse({ ...validValues, concernTagIds: [], styleTagIds: [] })
        .success
    ).toBe(true);
  });

  it('自己PR・修行期間は空でも通る', () => {
    expect(
      tellerProfileEditSchema.safeParse({ ...validValues, selfPr: '', trainingPeriod: '' }).success
    ).toBe(true);
  });

  it('自己PRが1001文字ならエラー', () => {
    expect(firstErrorMessage({ ...validValues, selfPr: 'あ'.repeat(1001) })).toBe(
      '自己PRは1000文字以内で入力してください'
    );
  });

  it('自己PRが1000文字なら通る', () => {
    expect(
      tellerProfileEditSchema.safeParse({ ...validValues, selfPr: 'あ'.repeat(1000) }).success
    ).toBe(true);
  });

  it('修行期間が21文字ならエラー', () => {
    expect(firstErrorMessage({ ...validValues, trainingPeriod: 'あ'.repeat(21) })).toBe(
      '修行期間は20文字以内で入力してください'
    );
  });

  it('修行期間が20文字なら通る', () => {
    expect(
      tellerProfileEditSchema.safeParse({ ...validValues, trainingPeriod: 'あ'.repeat(20) }).success
    ).toBe(true);
  });

  it('自己PRと修行期間の前後のスペースは取り除かれる（スペースだけなら空になる）', () => {
    const result = tellerProfileEditSchema.safeParse({
      ...validValues,
      selfPr: ' よろしく　',
      trainingPeriod: '　 ',
    });

    expect(result.success && result.data).toMatchObject({ selfPr: 'よろしく', trainingPeriod: '' });
  });
});
