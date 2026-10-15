# CLAUDE.md

このファイルは、このリポジトリで作業する Claude Code (claude.ai/code) 向けのガイドです。

@AGENTS.md

## サービス概要
aterune は相談者と占い師をつなぐ占い相談アプリ。

### プロジェクト概要
Expo SDK 57（React Native 0.86、React 19、React Compiler 有効、typed routes）と Supabase バックエンドで構成されている。
対象は iOS、Android（dev client / EAS ビルド）、静的 Web。コードコメント・UI 文言・コミットメッセージは日本語で書かれているので、それに合わせること。

### コンセプト
占い師は無料で練習・経験値・フィードバックを得られ、相談者は無料で気軽に占いを体験・応援できる。

### ターゲット
占い師は、見習い・修行中の駆け出し占い師。練習相手・経験値・フィードバック・将来の有料化への足がかり。
相談者は、占いに興味がある気軽に試したいライトユーザと、セカンドオピニオンに利用したい相談者。占い師の応援をしたいなど。

### 特徴
- 双方向申し込み：相談者から占い師へ、占い師から相談者へ、どちらからもセッション申し込みができる（国内占いサービスで前例なし）
- 「応援して育てた占い師がプロになった」体験：既存サービスにはない文脈

### 用語
- **相談者**：占ってもらう側のユーザー。
- **占い師**：占う側のユーザー。占い師プロフィールを登録したユーザーで、相談者にもなれる。
- **セッション**：相談者と占い師の1回分のやり取りの単位。申込み → 承認／拒否 → 完了の流れで進む。
- **申込み**：相談者から占い師へ、または占い師から相談者へセッションを申し込むこと。
- **申込まれた側**：申込みを受けたユーザー。承認・拒否ができる。
- **掲示板投稿（相談投稿）**：相談者が悩みを投稿する掲示板。占い師はここに応募してセッションを申し込む。
- **応募**：占い師が掲示板投稿に対してセッションを申し込むこと。
- **占術（タグ）**：タロット・西洋占星術などの占いの種類。占い師に紐づける。
- **お気に入り**：相談者が占い師を登録しておく機能。
- **レビュー**：セッション後に相談者が占い師へ付ける評価（一方向）。
- **通知**：アプリ内通知とプッシュ通知の元になるもの。セッションの申込み・状態変化で作られる。


## コマンド

```bash
npm start                      # expo start（expo-dev-client を使用）
npm run android | ios | web
npm run lint                   # expo lint
npm test                       # jest（preset: jest-expo）
npx jest src/lib/auth.test.ts  # 1ファイルだけ実行
npx jest -t "createSessionFromUrl"  # テスト名で絞り込み

# Supabase（devDependency の `supabase` でローカルスタックを動かす）
npx supabase start
npx supabase db reset          # マイグレーションと seed を再適用
npx supabase test db           # supabase/tests/database/ の pgTAP テスト
npx supabase migration new <name>
npx supabase gen types typescript --local > src/types/database.types.ts
npx supabase db push           # 未適用のマイグレーションをリモートへ適用
npx supabase db reset --linked # リモートを全消去して全マイグレーションを再適用（開発段階のみ）
# リモートで pgTAP テスト（--linked は不可。パスワードはダッシュボードの Database 設定を参照）
npx supabase test db --db-url "postgresql://postgres.kwjgxjtsyjzajdcaqnpd:<DBパスワード>@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres"
```

`.npmrc` で `legacy-peer-deps=true` を設定しており、インストールはこれが前提（NativeWind v5 preview / gluestack v5 alpha の peer 範囲のため）。

環境変数：`EXPO_PUBLIC_SUPABASE_URL` と `EXPO_PUBLIC_SUPABASE_ANON_KEY`（`.env` / `.env.local` に置く。gitignore 済み）。

文字コードは UTF-8（BOM なし）、改行コードは LF に統一する（開発 PC は Mac と Windows の両方）。改行コードは `.gitattributes` の `eol=lf` で git 側から強制し、VS Code は `.vscode/settings.json` で UTF-8 / LF を指定している。Windows PowerShell 5.1 の `>` は BOM 付きや UTF-16 で書き出すことがあるため、型生成などファイルへのリダイレクトを伴うコマンドは Bash で実行する。

## アーキテクチャ

### フォルダ構成
設定ファイル（`app.json`、`eas.json` など）はルートに、アプリのコードはすべて `src/` に置く。（未作成）のフォルダは必要になった時点で作る。

```
src/
├── app/            # ルーティング専用。screens を描画するだけの薄いファイル（テストは置かない）
├── screens/<name>/ # 画面単位の UI・フォーム処理（index.tsx、schema.ts）
│   └── components/ # その画面専用のサブコンポーネント（未作成）
├── components/     # 2画面以上で使う共通コンポーネント
│   └── ui/         # gluestack-ui からコピーしたコンポーネント
├── api/            # Supabase への問い合わせ。テーブル・機能単位でまとめる（未作成）
├── lib/            # 外部 SDK の初期化・設定（supabase.ts など）
├── utils/          # 外部に依存しない純粋な関数（未作成）
├── hooks/          # 再利用するカスタムフック（use-*.ts）
├── providers/      # Context Provider
├── types/          # 型定義（database.types.ts は自動生成）
├── test-utils/     # テスト用の共通処理（未作成）
└── __tests__/      # 複数画面にまたがるテスト（ルート・レイアウトなど）
supabase/
├── migrations/     # スキーマ（1マイグレーションにつき1テーブル／1機能）
├── tests/database/ # pgTAP テスト
└── functions/      # Edge Functions（未作成）
```

- **ルートファイルを薄くする理由**：UI とロジックを `screens/` に置くと、同じ画面を複数のルートから使え、ルートに依存せずテストできる。
- **データの取得・更新は `api/` に置く**：画面やフックは `supabase` を直接呼ばず、`api/` の関数を呼ぶ。画面のテストでは `api/` をモックすればよい。`lib/` は SDK の初期化・設定だけにする。
  - 現状は移行前で、`lib/auth.ts`・`lib/push-token.ts` に Supabase への問い合わせがあり、ログイン画面は `supabase` を直接呼んでいる。新しく書くコードは `api/` に置き、既存分の移行は別作業で行う。
- **Service Role Key はアプリのコードに置かない**：RLS を越える処理（退会時のユーザー削除、外部 API への送信、Webhook など）は、DB 内で完結するものは `security definer` の関数・トリガー、外部とのやり取りを伴うものは Supabase Edge Functions（`supabase/functions/`）に書く。Expo の API ルート（`app/api/`）や `server/` フォルダは使わない（Web は `static` 出力で、別にサーバーを運用しないため）。

### アプリ層（`src/`）
- **ルーティング**（`src/app/`、expo-router）：ルートファイルは `src/screens/<name>/` のコンポーネントを描画するだけの薄いラッパー。UI・フォーム処理は screens 側が持ち、zod の `schema.ts`（と `schema.test.ts`）を同じフォルダに置く。
- **認証によるアクセス制御**：`AuthProvider`（`src/providers/auth-provider.tsx`）が Supabase のセッションを保持し、`useAuth()`（`src/hooks/use-auth.ts`）で読む。ルートレイアウトは `loading` の完了を待ってから描画し、`(auth)` グループのレイアウトはログイン済みユーザーを `/(app)` へ、`(app)` グループのレイアウトは未ログインユーザーを `/(auth)/login` へリダイレクトする。`src/app/auth/`（例：`/auth/confirmed`）はどちらのグループにも属さないため、認証状態に関係なく表示される。
- **メール確認フロー**：Supabase クライアントは `detectSessionInUrl: false` なので、`src/lib/auth.ts` の `createSessionFromUrl` が URL のフラグメント／クエリからトークンを自前で読み取り、`setSession` を呼ぶ。戻り先はモバイルが `aterune://auth/confirmed`、Web が `${window.location.origin}/auth/confirmed`（各オリジンを Supabase の Redirect URLs 許可リストに登録する必要がある）。
- **Push token**（`src/lib/push-token.ts`）：ログイン後／メール確認からの自動ログイン後に `push_tokens` へ保存する。RLS 上ログイン中しか削除できないため、`signOut()` では `supabase.auth.signOut()` を呼ぶ*前に*削除する。Web とシミュレータでは早期リターンする。
- **Supabase クライアント**（`src/lib/supabase.ts`）：`window` が無い環境（静的 Web の事前レンダリング）ではストレージとトークン自動更新を無効にしている。
- **UI**：「UI（gluestack-ui / NativeWind）」節を参照。フォームは react-hook-form + `zodResolver`、エラーは `useErrorToast` で表示する。
- **型**：`src/types/database.types.ts` は自動生成なので手で編集しない。`src/types/index.ts` で `Tables<'...'>` を使った行の型エイリアス（`Profile`、`Session` など）を公開している。
- パスエイリアス `@/` → `src/`（`tsconfig.json` と `babel.config.js` の両方で設定）。

### UI（gluestack-ui / NativeWind）
- gluestack-ui v5 のコンポーネントを `src/components/ui/` にコピーして使う（一部に `.web.tsx` の Web 版あり）。スタイルは NativeWind v5 / Tailwind v4（`global.css`、`metro.config.js`）。
- **スタイル**：NativeWind の `className` で書く。`style={{}}` は動的な値（アニメーションの値など）を除いて使わない。
- **コンポーネント**：React Native のコア部品ではなく gluestack-ui のコンポーネントを使う。仮実装でも同じ。
- **`components/ui/` は書き換えない**：独自の見た目・挙動を加えてアプリ全体で揃えたいものは、`src/components/` で包んだ共通コンポーネントを作る。
- **コンポーネントの追加**：`components/ui/` に無いものを使うときは、依存パッケージの追加を伴うことがあるため、事前に承認を得てから追加する。

#### React Native → gluestack-ui 対応表
- **機械的に決まるもの**：TextInput → Input + InputField、Button（ボタン用途）→ Button + ButtonText、ActivityIndicator → Spinner、Image → Image、Switch → Switch、ScrollView → ScrollView、チェックボックス → Checkbox、ラジオボタン → Radio、セレクトボックス → Select、モーダル → Modal、下からせり上がるメニュー → Actionsheet、ツールチップ → Tooltip、アバター画像 → Avatar、バッジ・タグ → Badge、カード → Card、リンクテキスト → Link。
- **View → Box / VStack / HStack / Center**：並べ方の役割で選ぶ。縦並び＝VStack、横並び＝HStack、中央寄せ＝Center、並べ方にこだわらない箱＝Box。グリッド状に並べるなら Grid、区切り線なら Divider。
- **TouchableOpacity → Button / Pressable**：明確なアクション（サインイン・送信・確定など）は Button。カードをタップして詳細へ遷移するなど、ボタンではないタップ領域は Pressable。
- **Text → Text / Heading**：フォントサイズではなく役割で選ぶ。画面タイトル・セクション見出しは Heading、それ以外（本文・ラベル・キャプションなど）は Text。
- **メッセージ表示 → FormControlError / Toast / AlertDialog**：入力欄のバリデーションエラーは FormControl + FormControlError。自動で消える確認不要の通知（保存完了・通信エラーなど）は Toast（`useErrorToast`）。ユーザーの選択・確認が必要なもの（削除確認・ログアウト確認など）は AlertDialog。

#### 仮実装
- 仮実装の箇所には `// TODO: 仮実装` に続けて、何が仮なのか・本実装で何をすべきかを一言添える。
  ```ts
  // TODO: 仮実装。バックエンド動作確認のため最低限の表示のみ。
  // 本実装時はデザイン方針確定後に gluestack-ui コンポーネントで作り直す
  ```
- 既存の例外：`src/components/animated-icon.tsx`（`.web.tsx`・`.module.css`）は Expo テンプレートのままの仮実装で、`StyleSheet` とコア部品を使っている。書き直しは issue で管理する。

### データベース（`supabase/`）
- スキーマはすべてマイグレーションで管理する（1マイグレーションにつき1テーブル／1機能）。業務ルールはクライアントではなく Postgres の RLS ポリシーとトリガーで守る。例：`sessions` の status 遷移は `guard_session_status_change` がガードする（pending→active/rejected は申込まれた側のみ、completed は相談者のみ、expired/auto_completed はシステム＝`auth.uid()` が null の場合のみ）。
- **開発段階中のスキーマ変更**：既存のテーブル・関数などを直すときは、変更用のマイグレーション（`alter …` / `rename …`）を追加せず、元のマイグレーションを直接修正する。適用済みのマイグレーションは `db push` で再適用されないため、リモートは `npx supabase db reset --linked` で全消去して全マイグレーションを再適用する（データは消えてよい前提。リモートへの操作はユーザーが行う）。本番運用を始めたらこの方針は廃止し、変更用のマイグレーションを追加する。
- 役割はセッションごとに決まり、同じユーザーが相談者にも占い師にもなれる（`profiles.is_teller` は `teller_profiles` からトリガーで同期）。セッションの起点は、相談者からの申込みか、占い師による `consultation_posts`（掲示板投稿）への応募のどちらか（`initiated_by`）。
- `notifications` の行は `sessions` のトリガーで作られる。外部へのプッシュ送信は Vault + `pg_net` で作る予定（拡張は有効化済み）。
- 規約：トリガー関数には `set search_path = ''` を付ける。`security definer` は他テーブルへの書き込みなど RLS を越える必要がある場合のみ付ける（`guard_session_status_change` のように呼び出し元の権限で動けばよいガード用トリガーには付けない）。どちらの場合もオブジェクト名はスキーマ修飾して書く。テーブルとカラムには日本語の `comment on` を付ける。

### 命名規則

#### ファイル・フォルダ
- kebab-case に統一する（例：`use-auth.ts`、`auth-provider.tsx`、`screens/auth-confirmed/`）。
- プラットフォーム別の実装は `.web.tsx` などの接尾辞で分ける。テストは `<対象>.test.ts(x)`。
- expo-router の予約名（`_layout.tsx`、`(group)/`、`+not-found.tsx` など）はその規約に従う。

#### TypeScript / React
- コンポーネント・型：PascalCase（例：`AuthProvider`、`LoginFormValues`）。
- ルートファイルの default export は `<Name>Screen` / `<Name>Layout`、`screens/<name>/` の named export は接尾辞なしの `<Name>`（例：`LoginScreen` が `Login` を描画）。
- hooks：`use` で始まる camelCase（例：`useAuth`）。
- 関数・変数：camelCase。真偽値は `is` / `has` / `can` で始める（例：`isLoading`、`hasError`、`canSubmit`）。
- イベントハンドラ：props 名は `onXxx`、それに渡す実装は `handleXxx`（例：`onPress={handleSubmit}`）。
- 定数（モジュール直下の固定値）：UPPER_SNAKE_CASE（例：`MOBILE_AUTH_REDIRECT_URL`）。
- zod スキーマは `<name>Schema`、推論した型は `<Name>FormValues`（例：`loginSchema` / `LoginFormValues`）。
- テーブル行の型エイリアスはテーブル名を単数形の PascalCase にする（例：`push_tokens` → `PushToken`）。

#### データベース
- 識別子はすべて snake_case で、引用符で囲まない（ポリシー名も含む）。
- テーブル：複数形（例：`sessions`、`teller_profiles`）。
- カラム：外部キーは `<名詞>_id`、日時は `<動詞の過去分詞>_at`（例：`created_at`、`expires_at`）、真偽値は `is_*` / `requires_*`。
- 関数：`<動詞>_<目的語>`（例：`sync_is_teller`、`notify_session_status_change`）。
- トリガー：`<table>_<purpose>`（例：共通関数 `set_updated_at()` を使う `sessions_set_updated_at`）。例外として `auth.users` の `on_auth_user_created` は Supabase 公式の慣習名のまま使う。
- ポリシー：`<table>_<action>_<scope>`（例：`sessions_select_own`、`tags_select_public`）。
- インデックス：`<table>_<column>_idx`（例：`sessions_teller_id_idx`）。
- 制約：Postgres の自動命名に合わせて種類ごとの接尾辞を付ける。CHECK は `<table>_<内容>_check`、UNIQUE は `_key`、外部キーは `_fkey`（例：`sessions_status_check`、`push_tokens_user_id_expo_push_token_key`）。
- PL/pgSQL のローカル変数は `v_` で始める（例：`v_status`）。
- マイグレーション：`<timestamp>_<動詞>_<対象>.sql`（例：`create_sessions`）。`npx supabase migration new <動詞>_<対象>` で作る。

### テスト
- **配置の基本**：テストは対象と同じフォルダに `*.test.ts(x)` で置く（例：`src/lib/auth.test.ts`、`src/screens/<name>/schema.test.ts`）。
- **例外（`src/app/`）**：`src/app/` 配下はすべてルートとして扱われるため、ルート・レイアウトのテストは `src/__tests__/` に置く。
- **共通モジュール**：テスト用の共通処理（独自の render、モックの準備など）は `src/test-utils/` に置く。`__tests__/` 内のファイルは名前に関係なく jest がテストとして実行するため、そこには置かない。
- **全体設定・手動モック**：全テスト共通の設定はルートの `jest.setup.ts`（`setupFilesAfterEnv` に登録）、モジュール丸ごとの手動モックは jest の規約どおり `__mocks__/` に置く。
- **モックの書き方**：`./supabase` などの lib モジュールは `jest.mock` でモックし、`Platform.OS` は `jest.replaceProperty` で差し替える。
- **DB（pgTAP）**：マイグレーションごとに対応する pgTAP テスト `supabase/tests/database/<table>.test.sql` を用意する（`begin; … rollback;` で囲み、`auth.users` にテストデータを入れ、ロールを切り替えて RLS を検証する）。リモートで実行するときは `--linked` ではなく `--db-url` で `postgres` ロールとして接続する（「コマンド」節参照）。`--linked` は CLI の一時ロール `cli_login_postgres` で接続し、このロールには pgTAP が入る `extensions` スキーマの使用権限が無く、`reset role` でもこのロールに戻るため、テストが動かない。


## 作業の進め方

### 実装前
- 実装・変更を始める前に、作業方針を提案し、ユーザーの承認を得てから着手すること。
- ファイルの閲覧、検索、lint・テストの実行などの調査は承認なしで行ってよい。
- 不明点や仕様の曖昧な点は推測で進めず、提案時に質問すること。

### テストファースト
- 機能を1つ追加するときは、テストを先に書いてから実装する（テストを書く → 失敗を確認 → 実装 → 通ることを確認）。
- テストは全部書くのではなく、優先度の高いものに絞る。
  - **バックエンドを優先**：RLS ポリシー・トリガー・制約などの業務ルールは、pgTAP テストを必ず先に書く。
  - **フロントエンドは安全性に関わるものだけ**：認証・アクセス制御（リダイレクト）、zod スキーマのバリデーション、データの不整合やセキュリティにつながるロジックなど。
  - 見た目・レイアウトだけを確かめる UI テストは、原則として書かない。
- 方針を提案するときに、書く予定のテストの一覧を示す。フロントエンドで書かないものがあれば、その理由も添える。

### 実装中
- 作業中に想定外の問題が見つかり計画を変える必要が出た場合は、作業を止めて相談すること。
- 依頼範囲外の変更（リファクタ、フォーマット修正など）はしない。気づいた点は完了報告で提案する。
- パッケージの追加・更新は事前に承認を得ること。
- 実装後、コミットはせず、コミットメッセージを提案すること（日本語、簡潔に）。例：`ログイン画面にパスワード再設定リンクを追加`

### 完了後
次の順で確認・報告すること。
1. 関連する `npm test` が通ること
2. マイグレーションを追加・変更したら `npx supabase db reset` → `npx supabase test db` を実行し、型を再生成すること
3. `npm run lint` が通ること
4. `npx tsc --noEmit` が通ること
5. 以下を報告すること：変更したファイル、確認した内容（lint・テスト結果）、未確認の点。


### git 操作
- `git status` / `git diff` / `git log` など参照系のみ使用してよい。
- `git add` / `commit` / `push` / ブランチ操作 / `reset` / `stash` などの変更系操作はしない（ユーザーが行う）。
