import { messageSchema } from './schema';

function firstErrorMessage(values: unknown) {
  const result = messageSchema.safeParse(values);
  return result.success ? undefined : result.error.issues[0].message;
}

describe('messageSchema', () => {
  it('メッセージが入力されていれば通る', () => {
    expect(messageSchema.safeParse({ content: 'よろしくお願いします' }).success).toBe(true);
  });

  it('空ならエラー', () => {
    expect(firstErrorMessage({ content: '' })).toBe('メッセージを入力してください');
  });

  it('スペース・改行だけならエラー', () => {
    expect(firstErrorMessage({ content: '　 \n' })).toBe('メッセージを入力してください');
  });

  it('1001文字ならエラー', () => {
    expect(firstErrorMessage({ content: 'あ'.repeat(1001) })).toBe(
      'メッセージは1000文字以内で入力してください'
    );
  });

  it('ちょうど1000文字なら通る', () => {
    expect(messageSchema.safeParse({ content: 'あ'.repeat(1000) }).success).toBe(true);
  });

  it('前後の空白を除いて保存する', () => {
    expect(messageSchema.parse({ content: '  こんにちは\n' })).toEqual({ content: 'こんにちは' });
  });
});
