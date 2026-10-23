import { getConsultationApplyErrorMessage } from './consultation-apply-error';

const FALLBACK_MESSAGE = '応募できませんでした。時間をおいて、もう一度お試しください';

describe('getConsultationApplyErrorMessage', () => {
  test.each([
    ['cannot apply to a closed post', 'このお悩みは閉じられたため、応募できません'],
    [
      'an open session already exists between the consultant and the teller',
      'この相談者とは、承認待ちか進行中のやり取りがあるため応募できません',
    ],
    ['only tellers can apply to a post', '応募するには占い師の登録が必要です'],
    ['cannot apply to your own post', '自分のお悩みには応募できません'],
    ['the post does not exist', 'このお悩みは見つかりませんでした'],
  ])('DB のエラーが「%s」なら対応する日本語の文言を返す', (message, expected) => {
    expect(getConsultationApplyErrorMessage({ code: 'P0001', message })).toBe(expected);
  });

  test('同じお悩みへの2回目の応募（UNIQUE 制約の違反）なら、応募済みの文言を返す', () => {
    expect(
      getConsultationApplyErrorMessage({
        code: '23505',
        message:
          'duplicate key value violates unique constraint "sessions_post_id_teller_id_key"',
      })
    ).toBe('このお悩みにはすでに応募しています');
  });

  test('分からないエラー（通信エラーなど）なら共通の文言を返す', () => {
    expect(
      getConsultationApplyErrorMessage({ code: '', message: 'TypeError: Network request failed' })
    ).toBe(FALLBACK_MESSAGE);
  });
});
