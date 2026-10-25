---
paths:
  - "supabase/**"
---

# データベース（`supabase/`）

- スキーマはすべてマイグレーションで管理する（1マイグレーションにつき1テーブル／1機能）。業務ルールはクライアントではなく Postgres の RLS ポリシーとトリガーで守る。例：`sessions` の status 遷移は `guard_session_status_change` がガードする（pending→active/rejected は申込まれた側のみ、completed は相談者のみ、expired/auto_completed はシステム＝`auth.uid()` が null の場合のみ）。
- **開発段階中のスキーマ変更**：既存のテーブル・関数などを直すときは、変更用のマイグレーション（`alter …` / `rename …`）を追加せず、元のマイグレーションを直接修正する。適用済みのマイグレーションは `db push` で再適用されないため、リモートは `npx supabase db reset --linked` で全消去して全マイグレーションを再適用する（データは消えてよい前提。リモートへの操作はユーザーが行う）。本番運用を始めたらこの方針は廃止し、変更用のマイグレーションを追加する。
- 役割はセッションごとに決まり、同じユーザーが相談者にも占い師にもなれる（`profiles.is_teller` は `teller_profiles` からトリガーで同期）。セッションの起点は、相談者からの申込みか、占い師による `consultation_posts`（お悩み投稿）への応募のどちらか（`initiated_by`）。
- `notifications` の行は `sessions` と `messages` のトリガーで作られる。行が入ると `send_push_notification` トリガーが `pg_net` で Edge Function `send-push` を呼び、プッシュ通知を送る。宛先の URL と共有シークレットは Vault（`project_url`・`send_push_secret`）から読み、どちらかが無い環境では送信を飛ばす。
- 規約：トリガー関数には `set search_path = ''` を付ける。`security definer` は他テーブルへの書き込みなど RLS を越える必要がある場合のみ付ける（`guard_session_status_change` のように呼び出し元の権限で動けばよいガード用トリガーには付けない）。どちらの場合もオブジェクト名はスキーマ修飾して書く。テーブルとカラムには日本語の `comment on` を付ける。

## リモートへのコマンド

```bash
npx supabase db push           # 未適用のマイグレーションをリモートへ適用
npx supabase db reset --linked # リモートを全消去して全マイグレーションを再適用（開発段階のみ）
# リモートで pgTAP テスト（--linked は不可。パスワードはダッシュボードの Database 設定を参照）
npx supabase test db --db-url "postgresql://postgres.kwjgxjtsyjzajdcaqnpd:<DBパスワード>@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres"
npx supabase functions deploy send-push  # Edge Function の反映（verify_jwt は config.toml の設定が使われる）
```

### プッシュ送信のシークレット
送る側（DB のトリガー）と受ける側（Edge Function の send-push）で、同じ合言葉を別々の場所に持つ。値が食い違うと send-push が 401 を返し、通知が届かない。

| 置き場所 | 中身 | 使う側 | `db reset --linked` で |
|---|---|---|---|
| Vault（DB の中） | `project_url`（Supabase プロジェクトの URL。末尾に `/` を付けない）と `send_push_secret` | DB のトリガー | 消える |
| Edge Function の secrets（プロジェクトの設定） | `SEND_PUSH_SECRET` | send-push | 消えない |

合言葉は `openssl rand -hex 32` などで作り、パスワード管理ツールなどに保存しておく。Vault が未登録でもエラーにはならず、通知が送られないだけなので、リセット後に通知が届かないときはまずここを確かめる。

**リモートの DB を作り直したとき（`db reset --linked` のあと）**：SQL Editor で Vault に2件を登録する。`SEND_PUSH_SECRET` は消えていないので、前と同じ値を使うなら `secrets set` は不要。`push_tokens` も消えるため、端末ではログインし直して token を保存し直す。

```sql
select vault.create_secret('https://kwjgxjtsyjzajdcaqnpd.supabase.co', 'project_url');
select vault.create_secret('<ランダムな値>', 'send_push_secret');
```

```bash
npx supabase secrets set SEND_PUSH_SECRET=<上と同じ値>  # 初回と、値を変えたときだけ
```

**作り直さずに合言葉だけ変えるとき（運用中）**：Vault を更新し、続けて同じ新しい値で `secrets set` を実行する。2つの間に送られた通知は 401 になって届かないため、続けて実行する。

```sql
select vault.update_secret(
  (select id from vault.secrets where name = 'send_push_secret'),
  '<新しい値>'
);
```

```bash
npx supabase secrets set SEND_PUSH_SECRET=<上と同じ新しい値>
```

ローカルで試すときは、`supabase/functions/.env`（gitignore 済み）に `SEND_PUSH_SECRET` を書いて `npx supabase functions serve send-push --env-file supabase/functions/.env` で起動し、Vault の `project_url` は DB のコンテナから届く `http://supabase_kong_aterune:8000` にする。

## 命名規則
- 識別子はすべて snake_case で、引用符で囲まない（ポリシー名も含む）。
- テーブル：複数形（例：`sessions`、`teller_profiles`）。
- カラム：外部キーは `<名詞>_id`、日時は `<動詞の過去分詞>_at`（例：`created_at`、`expires_at`）、真偽値は `is_*` / `requires_*`。
- 関数：`<動詞>_<目的語>`（例：`sync_is_teller`、`notify_session_status_change`）。
- トリガー：`<table>_<purpose>`（例：共通関数 `set_updated_at()` を使う `sessions_set_updated_at`）。例外として `auth.users` の `on_auth_user_created` は Supabase 公式の慣習名のまま使う。
- ポリシー：`<table>_<action>_<scope>`（例：`sessions_select_own`、`tags_select_public`）。
- インデックス：`<table>_<column>_idx`（例：`sessions_teller_id_idx`）。
- 制約：Postgres の自動命名に合わせて種類ごとの接尾辞を付ける。CHECK は `<table>_<内容>_check`、UNIQUE は `_key`、外部キーは `_fkey`（例：`sessions_status_check`、`push_tokens_expo_push_token_key`）。
- PL/pgSQL のローカル変数は `v_` で始める（例：`v_status`）。
- マイグレーション：`<timestamp>_<動詞>_<対象>.sql`（例：`create_sessions`）。`npx supabase migration new <動詞>_<対象>` で作る。

## テスト（pgTAP）
- マイグレーションごとに対応する pgTAP テスト `supabase/tests/database/<table>.test.sql` を用意する（`begin; … rollback;` で囲み、`auth.users` にテストデータを入れ、ロールを切り替えて RLS を検証する）。リモートで実行するときは `--linked` ではなく `--db-url` で `postgres` ロールとして接続する（「リモートへのコマンド」節参照）。`--linked` は CLI の一時ロール `cli_login_postgres` で接続し、このロールには pgTAP が入る `extensions` スキーマの使用権限が無く、`reset role` でもこのロールに戻るため、テストが動かない。
