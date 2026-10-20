---
paths:
  - "**/*.test.ts"
  - "**/*.test.tsx"
  - "src/__tests__/**"
  - "src/test-utils/**"
  - "**/__mocks__/**"
  - "jest.setup.ts"
---

# テスト

何をどこまでテストするか（テストで確かめるもの・手動で確かめるもの）は CLAUDE.md の「作業の進め方 › テストファースト」に従う。このファイルは書き方と置き場所の規約。DB（pgTAP）のテストは `.claude/rules/database.md` を参照。

## ツール・環境
- Jest（`jest-expo`）＋ React Native Testing Library v14。ルーティングのテストは `expo-router/testing-library` の `renderRouter` を使う。
- `babel.config.js`：`nativewind/babel` が `@react-native/jest-preset` の RN モックまで書き換えると循環 import で落ちるため、そのファイルだけ対象から外している。アプリ実行時の挙動は変わらない。
- `package.json` の `jest.transformIgnorePatterns` は未設定。gluestack-ui を使う画面をテストすると `@gluestack-ui/core` の ESM が変換されず SyntaxError になるため、その前に jest-expo の初期値の許可リストへ `@gluestack-ui` を加える必要がある。ESM で配布されるライブラリで「Unexpected token 'export'」が出たら同様に追加する。

## 配置
- **基本**：テストは対象と同じフォルダに `<対象>.test.ts(x)` で置く（例：`src/api/auth.test.ts`、`src/screens/<name>/schema.test.ts`、1画面のテストなら `src/screens/<name>/index.test.tsx`）。
- **例外（`src/app/`）**：`src/app/` 配下はすべてルートとして扱われるため、ルート・レイアウトなど複数画面にまたがるテストは `src/__tests__/` に置く（例：`src/__tests__/layouts.test.tsx`）。
- **共通モジュール**：テスト用の共通処理（独自の render、モックの準備など）は `src/test-utils/` に置く。`__tests__/` 内のファイルは名前に関係なく jest がテストとして実行するため、そこには置かない。
- **全体設定・手動モック**：全テスト共通の設定はルートの `jest.setup.ts`（未作成。作るときは `setupFilesAfterEnv` に登録）、モジュール丸ごとの手動モックは jest の規約どおり `__mocks__/` に置く。

## モック
- **1つ下の層をモックする**：画面のテストでは `api/`・`lib/` の関数やフックを、`api/`・`lib/` のテストでは Supabase クライアント（`@/lib/supabase`、同じフォルダからなら `./supabase`）を `jest.mock` でモックする。
- 画面のテストでは `expo-router`（`useRouter`）と `useErrorToast` もモックし、「どこへ移動しようとしたか」「どのメッセージを出そうとしたか」を確かめる。
- `Platform.OS` は `jest.replaceProperty` で差し替える。

## 書き方
- テスト名は日本語で「〇〇なら△△する」の形にし、何を保証しているかが分かるように書く。
- 不具合を直すときは、先にその不具合で失敗するテストを書き、失敗を確認してから修正する。
- RNTL v14 では `render` / `renderHook` / `fireEvent` が非同期なので、必ず `await` を付ける。
- `renderRouter` の `getPathname()` は戻り値の Promise に付いている（`const r = renderRouter(...); await r; r.getPathname()`）。`toHavePathname` は型定義が無く tsc で落ちるので使わない。
- `jest.mock` の factory 内で参照する変数は、名前を `mock` で始める（jest の制約）。
