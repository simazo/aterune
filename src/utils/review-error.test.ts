import { getReviewErrorMessage } from './review-error';

describe('getReviewErrorMessage', () => {
  it('2回目の投稿（UNIQUE 制約の違反）なら、投稿済みの文言を返す', () => {
    expect(getReviewErrorMessage({ code: '23505', message: 'duplicate key value' })).toBe(
      'このやり取りにはすでにレビューを投稿しています'
    );
  });

  it('RLS に弾かれた（完了から7日を過ぎたなど）なら、期間切れの文言を返す', () => {
    expect(
      getReviewErrorMessage({ code: '42501', message: 'new row violates row-level security policy' })
    ).toBe('レビューを書ける期間が過ぎています');
  });

  it('分からないエラー（通信エラーなど）なら共通の文言を返す', () => {
    expect(getReviewErrorMessage({ code: '', message: 'TypeError: Network request failed' })).toBe(
      'レビューを投稿できませんでした。時間をおいて、もう一度お試しください'
    );
  });
});
