---
paths:
  - "src/app/**"
  - "src/screens/**"
  - "src/components/**"
---

# UI（gluestack-ui / NativeWind）

- gluestack-ui v5 のコンポーネントを `src/components/ui/` にコピーして使う（一部に `.web.tsx` の Web 版あり）。スタイルは NativeWind v5 / Tailwind v4（`global.css`、`metro.config.js`）。
- **スタイル**：NativeWind の `className` で書く。`style={{}}` は動的な値（アニメーションの値など）を除いて使わない。
- **コンポーネント**：React Native のコア部品ではなく gluestack-ui のコンポーネントを使う。仮実装でも同じ。
- **`components/ui/` は書き換えない**：独自の見た目・挙動を加えてアプリ全体で揃えたいものは、`src/components/` で包んだ共通コンポーネントを作る。
  - 例外：型チェックが通らないなど、コピーしたままでは使えない場合だけは最小限に直し、ファイル冒頭のコメントに変更点と理由を書く（例：`avatar`、`badge`、`spinner`）。見た目・挙動は変えない。
- **背景が透明な部品**：gluestack はライトの画面背景を白と想定しているが、このアプリのライトの背景は色付き（`--background`）。画面の上に直接置く部品で、ライトの背景が透明または `bg-background` のもの（Input、Select、Button の outline など）は背景に溶け込むため、`src/components/` の共通部品で `bg-card` を付けて使う（例：`FilledInput`、`SelectableButton`）。まだ包んでいない部品は、初めて使うときに作る。
- **コンポーネントの追加**：`components/ui/` に無いものを使うときは、依存パッケージの追加を伴うことがあるため、事前に承認を得てから追加する。

## React Native → gluestack-ui 対応表
- **機械的に決まるもの**：TextInput → Input + InputField、Button（ボタン用途）→ Button + ButtonText、ActivityIndicator → Spinner、Image → Image、Switch → Switch、ScrollView → ScrollView（入力欄のある画面は `@/components/keyboard-aware-scroll-view` の KeyboardAwareScrollView。フォーカスした入力欄がキーボードに隠れないよう自動でスクロールする）、チェックボックス → Checkbox、ラジオボタン → Radio、セレクトボックス → Select、モーダル → Modal、下からせり上がるメニュー → Actionsheet、ツールチップ → Tooltip、アバター画像 → Avatar、バッジ・タグ → Badge、カード → Card、リンクテキスト → Link。
- **View → Box / VStack / HStack / Center**：並べ方の役割で選ぶ。縦並び＝VStack、横並び＝HStack、中央寄せ＝Center、並べ方にこだわらない箱＝Box。グリッド状に並べるなら Grid、区切り線なら Divider。
- **TouchableOpacity → Button / Pressable**：明確なアクション（サインイン・送信・確定など）は Button。カードをタップして詳細へ遷移するなど、ボタンではないタップ領域は Pressable。
- **Text → Text / Heading**：フォントサイズではなく役割で選ぶ。画面タイトル・セクション見出しは Heading、それ以外（本文・ラベル・キャプションなど）は Text。
- **メッセージ表示 → FormControlError / Toast / AlertDialog**：入力欄のバリデーションエラーは FormControl + FormControlError。自動で消える確認不要の通知（保存完了・通信エラーなど）は Toast（`useErrorToast`）。ユーザーの選択・確認が必要なもの（削除確認・ログアウト確認など）は AlertDialog。

## 仮実装
- 仮実装の箇所には `// TODO: 仮実装` に続けて、何が仮なのか・本実装で何をすべきかを一言添える。
  ```ts
  // TODO: 仮実装。バックエンド動作確認のため最低限の表示のみ。
  // 本実装時はデザイン方針確定後に gluestack-ui コンポーネントで作り直す
  ```
- 既存の例外：`src/components/animated-icon.tsx`（`.web.tsx`・`.module.css`）は Expo テンプレートのままの仮実装で、`StyleSheet` とコア部品を使っている。書き直しは issue #2 で管理する。

## コンポーネントの切り出し
責務の単位で切り出す。切り出す動機は次の3つ。
1. **再利用**：複数の画面で同じ見た目・機能が出てくる。
2. **可読性**：1ファイルにロジックと見た目が詰め込まれて読みづらい。
3. **責務の分離**：性質の異なるロジックが混在している。

線引きと置き場所：
- ある画面にしか出てこない単純な表示部品 → 切り出さず画面ファイル内に書く。
- 1画面内でまとまりが大きいもの（フォーム部分、ボタン群など）→ 画面専用のサブコンポーネントとして `screens/<name>/components/` に分ける（共通化はしない）。
- 2画面以上で使うもの（エラー表示、ローディング表示など）→ `src/components/` に共通コンポーネントとして置く。
- gluestack-ui に独自の見た目・挙動を加えてアプリ全体で揃えたいもの → `src/components/` に共通コンポーネントとして置く。

行数の目安は決めず、都度判断する。実装中に分割した方が良いと判断したら、方針として提案し、承認を得てから分割する。
