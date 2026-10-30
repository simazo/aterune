import { getSessionRequestErrorMessage } from './session-request-error';

const FALLBACK_MESSAGE = '申し込めませんでした。時間をおいて、もう一度お試しください';

describe('getSessionRequestErrorMessage', () => {
  test.each([
    [
      'the teller is not accepting session requests',
      'この占い師は現在、申込みを受け付けていません',
    ],
    [
      "the teller requires the consultant's birthdate",
      'この占い師への申込みには生年月日の登録が必要です',
    ],
    [
      'an open session already exists between the consultant and the teller',
      'この占い師にはすでに申し込んでいます',
    ],
    // どちらの向きのブロックかは伝えない
    ['cannot send a request to this user', 'この相手には申し込めません'],
  ])('DB のエラーが「%s」なら対応する日本語の文言を返す', (message, expected) => {
    expect(getSessionRequestErrorMessage({ message })).toBe(expected);
  });

  test('分からないエラー（通信エラーなど）なら共通の文言を返す', () => {
    expect(getSessionRequestErrorMessage({ message: 'TypeError: Network request failed' })).toBe(
      FALLBACK_MESSAGE
    );
  });
});
