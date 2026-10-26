import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { launchImageLibraryAsync } from 'expo-image-picker';

// アップロードするアイコンの一辺(px)。表示は最大 64px(Avatar の lg)なので、高解像度(3倍)の端末でも足りる大きさ
const AVATAR_SIZE = 512;
const JPEG_QUALITY = 0.8;

// アイコンにする画像を写真から1枚選び、正方形の JPEG(一辺 512px)に縮小して返す。キャンセルしたら null。
// OS の写真ピッカーを使うので、写真へのアクセスの許可は求めない。
// Web は、ボタンを押した直後に呼ばないとファイル選択のダイアログが開かない
export async function pickAvatarImage(): Promise<ArrayBuffer | null> {
  // 切り抜く画面は iOS・Android だけ(Web では無視される)
  const result = await launchImageLibraryAsync({
    mediaTypes: 'images',
    allowsEditing: true,
    aspect: [1, 1],
  });
  if (result.canceled) return null;

  // 元の写真はネイティブ側のメモリに大きく載るため、使い終わったら(途中で失敗しても)解放する
  const toRelease: { release(): void }[] = [];
  try {
    // picker が返す幅・高さは 0 のことがあるため、一度描画して実際の大きさを読む
    const loader = ImageManipulator.manipulate(result.assets[0].uri);
    toRelease.push(loader);
    const original = await loader.renderAsync();
    toRelease.push(original);

    // Web は切り抜く画面が無いので、ここで中央を正方形に切り抜く。
    // iOS・Android でも、切り抜いた結果がぴったり正方形でない場合に備えて同じ処理を通す
    const side = Math.min(original.width, original.height);
    const context = ImageManipulator.manipulate(original);
    toRelease.push(context);
    context.crop({
      originX: Math.floor((original.width - side) / 2),
      originY: Math.floor((original.height - side) / 2),
      width: side,
      height: side,
    });
    // 小さい画像は引き伸ばさない
    if (side > AVATAR_SIZE) {
      context.resize({ width: AVATAR_SIZE, height: AVATAR_SIZE });
    }
    const rendered = await context.renderAsync();
    toRelease.push(rendered);
    const saved = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: JPEG_QUALITY });

    // supabase-js の upload に渡せるよう、ArrayBuffer にする(React Native では Blob ではなく ArrayBuffer を渡す)
    const response = await fetch(saved.uri);
    return await response.arrayBuffer();
  } finally {
    toRelease.forEach((ref) => ref.release());
  }
}
