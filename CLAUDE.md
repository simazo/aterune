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
```

`.npmrc` で `legacy-peer-deps=true` を設定しており、インストールはこれが前提（NativeWind v5 preview / gluestack v5 alpha の peer 範囲のため）。

環境変数：`EXPO_PUBLIC_SUPABASE_URL` と `EXPO_PUBLIC_SUPABASE_ANON_KEY`（`.env` / `.env.local` に置く。gitignore 済み）。

文字コードは UTF-8（BOM なし）、改行コードは LF に統一する（開発 PC は Mac と Windows の両方）。Windows PowerShell 5.1 の `>` は BOM 付きや UTF-16 で書き出すことがあるため、型生成などファイルへのリダイレクトを伴うコマンドは Bash で実行する。

## アーキテクチャ

### アプリ層（`src/`）
- **ルーティング**（`src/app/`、expo-router）：ルートファイルは `src/screens/<name>/` のコンポーネントを描画するだけの薄いラッパー。UI・フォーム処理は screens 側が持ち、zod の `schema.ts`（と `schema.test.ts`）を同じフォルダに置く。
- **認証によるアクセス制御**：`AuthProvider`（`src/providers/auth-provider.tsx`）が Supabase のセッションを保持し、`useAuth()`（`src/hooks/use-auth.ts`）で読む。ルートレイアウトは `loading` の完了を待ってから描画し、`(auth)` グループのレイアウトはログイン済みユーザーを `/(app)` へ、`(app)` グループのレイアウトは未ログインユーザーを `/(auth)/login` へリダイレクトする。`src/app/auth/`（例：`/auth/confirmed`）はどちらのグループにも属さないため、認証状態に関係なく表示される。
- **メール確認フロー**：Supabase クライアントは `detectSessionInUrl: false` なので、`src/lib/auth.ts` の `createSessionFromUrl` が URL のフラグメント／クエリからトークンを自前で読み取り、`setSession` を呼ぶ。戻り先はモバイルが `aterune://auth/confirmed`、Web が `${window.location.origin}/auth/confirmed`（各オリジンを Supabase の Redirect URLs 許可リストに登録する必要がある）。
- **Push token**（`src/lib/pushToken.ts`）：ログイン後／メール確認からの自動ログイン後に `push_tokens` へ保存する。RLS 上ログイン中しか削除できないため、`signOut()` では `supabase.auth.signOut()` を呼ぶ*前に*削除する。Web とシミュレータでは早期リターンする。
- **Supabase クライアント**（`src/lib/supabase.ts`）：`window` が無い環境（静的 Web の事前レンダリング）ではストレージとトークン自動更新を無効にしている。
- **UI**：gluestack-ui v5 のコンポーネントを `src/components/ui/` にコピーして使用（一部に `.web.tsx` の Web 版あり）。スタイルは NativeWind v5 / Tailwind v4（`global.css`、`metro.config.js`）。フォームは react-hook-form + `zodResolver`、エラーは `useErrorToast` で表示する。
- **型**：`src/types/database.types.ts` は自動生成なので手で編集しない。`src/types/index.ts` で `Tables<'...'>` を使った行の型エイリアス（`Profile`、`Session` など）を公開している。
- パスエイリアス `@/` → `src/`（`tsconfig.json` と `babel.config.js` の両方で設定）。
- 単体テストでは `./supabase` などの lib モジュールを `jest.mock` でモックし、`Platform.OS` は `jest.replaceProperty` で差し替える。

### データベース（`supabase/`）
- スキーマはすべてマイグレーションで管理する（1マイグレーションにつき1テーブル／1機能）。業務ルールはクライアントではなく Postgres の RLS ポリシーとトリガーで守る。例：`sessions` の status 遷移は `guard_session_status_change` がガードする（pending→active/rejected は申込まれた側のみ、completed は相談者のみ、expired/auto_completed はシステム＝`auth.uid()` が null の場合のみ）。
- 役割はセッションごとに決まり、同じユーザーが相談者にも占い師にもなれる（`profiles.is_teller` は `teller_profiles` からトリガーで同期）。セッションの起点は、相談者からの申込みか、占い師による `consultation_posts`（掲示板投稿）への応募のどちらか（`initiated_by`）。
- `notifications` の行は `sessions` のトリガーで作られる。外部へのプッシュ送信は Vault + `pg_net` で作る予定（拡張は有効化済み）。
- 規約：トリガー名は `<table>_<purpose>`（例：共通関数 `set_updated_at()` を使う `sessions_set_updated_at`）、ポリシー名は `<table>_<action>_<scope>`。トリガー関数には `set search_path = ''` を付ける。`security definer` は他テーブルへの書き込みなど RLS を越える必要がある場合のみ付ける（`guard_session_status_change` のように呼び出し元の権限で動けばよいガード用トリガーには付けない）。どちらの場合もオブジェクト名はスキーマ修飾して書く。テーブルとカラムには日本語の `comment on` を付ける。
- マイグレーションごとに対応する pgTAP テスト `supabase/tests/database/<table>.test.sql` を用意する（`begin; … rollback;` で囲み、`auth.users` にテストデータを入れ、ロールを切り替えて RLS を検証する）。


## 作業の進め方

### 実装前
- 実装・変更を始める前に、作業内容・方針・変更予定のファイルを提案し、ユーザーの承認（GO）を得てから着手すること。
- ファイルの閲覧、検索、lint・テストの実行などの調査は承認なしで行ってよい。
- 不明点や仕様の曖昧な点は推測で進めず、提案時に質問すること。

### 実装中
- 作業中に想定外の問題が見つかり計画を変える必要が出た場合は、作業を止めて相談すること。
- 依頼範囲外の変更（リファクタ、フォーマット修正など）はしない。気づいた点は完了報告で提案する。
- パッケージの追加・更新は事前に承認を得ること。

### 完了後
次の順で確認・報告すること。
1. 関連する `npm test` が通ること
2. マイグレーションを追加・変更したら `npx supabase db reset` → `npx supabase test db` を実行し、型を再生成すること
3. `npm run lint` が通ること
4. `npx tsc --noEmit` が通ること
5. 以下を報告すること：変更したファイル、確認した内容（lint・テスト結果）、未確認の点。
6. コミットメッセージを1行で提案すること（日本語、簡潔に）。例：`ログイン画面にパスワード再設定リンクを追加`

### git 操作
- `git status` / `git diff` / `git log` など参照系のみ使用してよい。
- `git add` / `commit` / `push` / ブランチ操作 / `reset` / `stash` などの変更系操作はしない（ユーザーが行う）。
