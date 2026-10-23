-- セッションの状態のうち、システムだけが変更できるもの(expired / auto_completed)を定期処理で更新する。
-- pg_cron のジョブは postgres として動き auth.uid() が null になるため、
-- guard_session_status_change ではシステムの操作として通る。通知は sessions のトリガーが作る。
-- ダッシュボードから有効化済みだった場合は、if not exists で何もしない。
create extension if not exists pg_cron with schema pg_catalog;

-- 期限を過ぎた承認待ちを期限切れにする(通知は作らない)。
-- 期限ちょうどは、承認・拒否のガード(expires_at < now() なら弾く)と揃えてまだ対象にしない
create function public.expire_session_requests()
returns void
language sql
set search_path = ''
as $$
  update public.sessions
     set status = 'expired'
   where status = 'pending'
     and expires_at < now();
$$;

-- 相談者の最終操作(last_activity_at)から7日を過ぎた進行中のセッションを自動完了にする(双方に通知)
create function public.auto_complete_sessions()
returns void
language sql
set search_path = ''
as $$
  update public.sessions
     set status = 'auto_completed'
   where status = 'active'
     and last_activity_at < now() - interval '7 days';
$$;

comment on function public.expire_session_requests() is '期限を過ぎた承認待ちのセッションを expired にする(定期処理専用)';
comment on function public.auto_complete_sessions()  is '相談者の最終操作から7日を過ぎた進行中のセッションを auto_completed にする(定期処理専用)';

-- 定期処理専用: Supabase が anon / authenticated に自動付与する権限も外す
revoke all on function public.expire_session_requests() from public, anon, authenticated;
revoke all on function public.auto_complete_sessions()  from public, anon, authenticated;

-- ============================================================
-- 定期実行のジョブ(同じ名前で登録し直すと上書きされる)
-- 実行履歴は cron.job_run_details に残り、ダッシュボードの Integrations → Cron で見られる
-- ============================================================
select cron.schedule(
  'expire-session-requests',
  '*/10 * * * *',
  'select public.expire_session_requests()'
);

select cron.schedule(
  'auto-complete-sessions',
  '*/10 * * * *',
  'select public.auto_complete_sessions()'
);

-- 実行履歴は自動では消えないので、7日より古いものを毎日 18:00 UTC(日本時間 3:00)に消す
select cron.schedule(
  'delete-old-cron-job-run-details',
  '0 18 * * *',
  $$delete from cron.job_run_details where end_time < now() - interval '7 days'$$
);
