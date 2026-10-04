-- ============================================================
-- 共通: updated_at を自動更新するトリガー関数
-- 各テーブルで次のように使う:
--   create trigger <table>_set_updated_at
--     before update on public.<table>
--     for each row execute function public.set_updated_at();
-- ============================================================
create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function public.set_updated_at() from public, anon, authenticated;