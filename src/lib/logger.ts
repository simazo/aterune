// アプリのログ出力。開発時（__DEV__）だけ出す
// 本番でも記録したくなったら（エラー収集サービスへの送信など）このファイルだけを直す
export const logger = {
  // 動作確認用
  debug: (...args: unknown[]) => {
    if (__DEV__) console.log(...args);
  },
  // 呼び出し元に返せない想定外の失敗
  warn: (...args: unknown[]) => {
    if (__DEV__) console.warn(...args);
  },
};
