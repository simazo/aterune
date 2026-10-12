-- ============================================================
-- pg_net 拡張: DB から外部へ HTTP リクエストを送る
-- プッシュ通知の Webhook 送信(Vault + pg_net)で使う。
-- ダッシュボードから有効化済みだった場合、
-- if not exists で何もしないようにしている。
-- ============================================================
create extension if not exists pg_net with schema extensions;
