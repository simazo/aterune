import { logger } from '@/lib/logger';
import { supabase } from '@/lib/supabase';
import { deleteAvatar, uploadAvatar } from './avatars';

jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: jest.fn(),
    storage: { from: jest.fn() },
  },
}));

jest.mock('@/lib/logger', () => ({
  logger: { debug: jest.fn(), warn: jest.fn() },
}));

const mockSupabase = jest.mocked(supabase);
const mockLogger = jest.mocked(logger);

const USER_ID = '00000000-0000-0000-0000-000000000001';
const OLD_PATH = `${USER_ID}/1700000000000.jpg`;
const NEW_PATH = `${USER_ID}/1730000000000.jpg`;
const IMAGE = new ArrayBuffer(8);

// storage.from('avatars') の upload・remove の呼び出しを記録するモック
function mockBucket({
  uploadError = null,
  removeErrors = [],
}: { uploadError?: unknown; removeErrors?: unknown[] } = {}) {
  const bucket = {
    upload: jest.fn().mockResolvedValue({ data: uploadError ? null : { path: NEW_PATH }, error: uploadError }),
    remove: jest.fn(),
  };
  for (const error of removeErrors) {
    bucket.remove.mockResolvedValueOnce({ data: error ? null : [], error });
  }
  bucket.remove.mockResolvedValue({ data: [], error: null });
  mockSupabase.storage.from.mockReturnValue(bucket as never);
  return bucket;
}

// from('profiles').update().eq() の呼び出しを記録するモック
function mockUpdateQuery(result: { error: unknown }) {
  const query = {
    update: jest.fn(),
    eq: jest.fn().mockResolvedValue(result),
  };
  query.update.mockReturnValue(query);
  mockSupabase.from.mockReturnValueOnce(query as never);
  return query;
}

beforeEach(() => {
  jest.resetAllMocks();
  jest.spyOn(Date, 'now').mockReturnValue(1730000000000);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('uploadAvatar', () => {
  it('新しいファイル名でアップロードし、avatar_pathを更新してから古いファイルを消す', async () => {
    const bucket = mockBucket();
    const query = mockUpdateQuery({ error: null });

    const result = await uploadAvatar(USER_ID, IMAGE, OLD_PATH);

    expect(mockSupabase.storage.from).toHaveBeenCalledWith('avatars');
    expect(bucket.upload).toHaveBeenCalledWith(NEW_PATH, IMAGE, {
      contentType: 'image/jpeg',
      upsert: false,
    });
    expect(mockSupabase.from).toHaveBeenCalledWith('profiles');
    expect(query.update).toHaveBeenCalledWith({ avatar_path: NEW_PATH });
    expect(query.eq).toHaveBeenCalledWith('id', USER_ID);
    expect(bucket.remove).toHaveBeenCalledWith([OLD_PATH]);
    // upload → update → 古いファイルの remove の順
    expect(bucket.upload.mock.invocationCallOrder[0]).toBeLessThan(
      query.update.mock.invocationCallOrder[0],
    );
    expect(query.eq.mock.invocationCallOrder[0]).toBeLessThan(
      bucket.remove.mock.invocationCallOrder[0],
    );
    expect(result).toEqual({ path: NEW_PATH, error: null });
  });

  it('アップロードに失敗したらavatar_pathを更新せずにerrorを返す', async () => {
    const error = { message: 'upload failed' };
    const bucket = mockBucket({ uploadError: error });

    const result = await uploadAvatar(USER_ID, IMAGE, OLD_PATH);

    expect(mockSupabase.from).not.toHaveBeenCalled();
    expect(bucket.remove).not.toHaveBeenCalled();
    expect(result).toEqual({ path: null, error });
  });

  it('avatar_pathの更新に失敗したら、今上げたファイルを消してerrorを返し、古いファイルは消さない', async () => {
    const error = { message: 'update failed' };
    const bucket = mockBucket();
    mockUpdateQuery({ error });

    const result = await uploadAvatar(USER_ID, IMAGE, OLD_PATH);

    expect(bucket.remove).toHaveBeenCalledTimes(1);
    expect(bucket.remove).toHaveBeenCalledWith([NEW_PATH]);
    expect(result).toEqual({ path: null, error });
  });

  it('アイコンが未設定(currentPathがnull)なら、古いファイルの削除はしない', async () => {
    const bucket = mockBucket();
    mockUpdateQuery({ error: null });

    const result = await uploadAvatar(USER_ID, IMAGE, null);

    expect(bucket.remove).not.toHaveBeenCalled();
    expect(result).toEqual({ path: NEW_PATH, error: null });
  });

  it('古いファイルの削除に失敗しても成功を返し、warnでログを出す', async () => {
    mockBucket({ removeErrors: [{ message: 'remove failed' }] });
    mockUpdateQuery({ error: null });

    const result = await uploadAvatar(USER_ID, IMAGE, OLD_PATH);

    expect(result).toEqual({ path: NEW_PATH, error: null });
    expect(mockLogger.warn).toHaveBeenCalledWith('アイコンのファイルの削除エラー:', 'remove failed');
  });
});

describe('deleteAvatar', () => {
  it('avatar_pathをnullに更新してからファイルを消す', async () => {
    const bucket = mockBucket();
    const query = mockUpdateQuery({ error: null });

    const result = await deleteAvatar(USER_ID, OLD_PATH);

    expect(query.update).toHaveBeenCalledWith({ avatar_path: null });
    expect(query.eq).toHaveBeenCalledWith('id', USER_ID);
    expect(mockSupabase.storage.from).toHaveBeenCalledWith('avatars');
    expect(bucket.remove).toHaveBeenCalledWith([OLD_PATH]);
    expect(query.eq.mock.invocationCallOrder[0]).toBeLessThan(
      bucket.remove.mock.invocationCallOrder[0],
    );
    expect(result).toEqual({ error: null });
  });

  it('avatar_pathの更新に失敗したらファイルを消さずにerrorを返す', async () => {
    const error = { message: 'update failed' };
    const bucket = mockBucket();
    mockUpdateQuery({ error });

    const result = await deleteAvatar(USER_ID, OLD_PATH);

    expect(bucket.remove).not.toHaveBeenCalled();
    expect(result).toEqual({ error });
  });

  it('ファイルの削除に失敗しても成功を返し、warnでログを出す', async () => {
    mockBucket({ removeErrors: [{ message: 'remove failed' }] });
    mockUpdateQuery({ error: null });

    const result = await deleteAvatar(USER_ID, OLD_PATH);

    expect(result).toEqual({ error: null });
    expect(mockLogger.warn).toHaveBeenCalledWith('アイコンのファイルの削除エラー:', 'remove failed');
  });
});
