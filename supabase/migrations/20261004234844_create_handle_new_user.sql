-- ============================================================
-- サインアップ時に profiles を自動作成する
-- 依存: public.profiles(別マイグレーション)
-- ============================================================

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''),
      nullif(split_part(new.email, '@', 1), ''),
      'ユーザー'
    )
  );
  return new;
end;
$$;

-- トリガー専用なので、API(rpc)から直接呼ばれないようにする
revoke all on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();