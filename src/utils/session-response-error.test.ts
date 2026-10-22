import {
  getSessionResponseErrorMessage,
  SESSION_ALREADY_HANDLED_MESSAGE,
} from './session-response-error';

const FALLBACK_MESSAGE = '処理できませんでした。時間をおいて、もう一度お試しください';

describe('getSessionResponseErrorMessage', () => {
  test.each([
    ['the session request has expired', '申込みの期限が切れています'],
    [SESSION_ALREADY_HANDLED_MESSAGE, 'この申込みはすでに処理されています'],
  ])('エラーが「%s」なら対応する日本語の文言を返す', (message, expected) => {
    expect(getSessionResponseErrorMessage({ message })).toBe(expected);
  });

  test('分からないエラー（通信エラーなど）なら共通の文言を返す', () => {
    expect(getSessionResponseErrorMessage({ message: 'TypeError: Network request failed' })).toBe(
      FALLBACK_MESSAGE
    );
  });
});
