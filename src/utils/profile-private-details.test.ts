import { getPrivateDetailsToSave } from './profile-private-details';

const SAVED = { birthdate: '1990-01-05', gender: 'female' as const };

describe('getPrivateDetailsToSave', () => {
  it('生年月日が空（未選択・選び途中）なら、保存済みの生年月日を残す', () => {
    expect(getPrivateDetailsToSave({ birthdate: '', gender: 'male' }, SAVED)).toEqual({
      birthdate: '1990-01-05',
      gender: 'male',
    });
  });

  it('生年月日も性別も変わっていなければnullを返す（保存しない）', () => {
    expect(getPrivateDetailsToSave({ birthdate: '1990-01-05', gender: 'female' }, SAVED)).toBeNull();
  });

  it('生年月日が空で性別も変わっていなければnullを返す（保存しない）', () => {
    expect(getPrivateDetailsToSave({ birthdate: '', gender: 'female' }, SAVED)).toBeNull();
  });

  it('生年月日を変えたら、新しい生年月日を返す', () => {
    expect(getPrivateDetailsToSave({ birthdate: '1991-02-03', gender: 'female' }, SAVED)).toEqual({
      birthdate: '1991-02-03',
      gender: 'female',
    });
  });

  it('性別を「回答しない」に変えたら、性別をnullにして返す', () => {
    expect(getPrivateDetailsToSave({ birthdate: '', gender: null }, SAVED)).toEqual({
      birthdate: '1990-01-05',
      gender: null,
    });
  });

  it('未登録で生年月日が空・性別が「回答しない」のままならnullを返す（行を作らない）', () => {
    expect(
      getPrivateDetailsToSave({ birthdate: '', gender: null }, { birthdate: null, gender: null })
    ).toBeNull();
  });

  it('未登録で生年月日だけ選んだら、性別はnullのまま返す', () => {
    expect(
      getPrivateDetailsToSave(
        { birthdate: '1990-01-05', gender: null },
        { birthdate: null, gender: null }
      )
    ).toEqual({ birthdate: '1990-01-05', gender: null });
  });
});
