-- register_push_token: ログイン中のユーザーに、この端末の push token を紐付ける(ログイン直後に呼ぶ)。
-- 依存: public.push_tokens
--
-- 1つの token を持てるのは1人だけ(push_tokens_expo_push_token_key)。
-- 同じ端末で前にログインしていた別ユーザーの行が残っていると、その人宛の通知がこの端末に届いてしまうため、
-- 同じ token の行があれば、行を消さずに持ち主をログイン中のユーザーに付け替える(id・created_at は元の行のまま)。
-- 自分の行がすでにあれば platform だけを更新する。
-- RLS 上、他人の行は書き換えられないので security definer を付ける。
-- 未ログイン(auth.uid() が null)なら例外にする。

create function public.register_push_token(p_token text, p_platform text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
begin
  if v_user_id is null then
    raise exception 'ログインが必要です' using errcode = '42501';
  end if;

  insert into public.push_tokens (user_id, expo_push_token, platform)
  values (v_user_id, p_token, p_platform)
  on conflict (expo_push_token) do update
    set user_id  = excluded.user_id,
        platform = excluded.platform;
end;
$$;

comment on function public.register_push_token(text, text) is
  'ログイン中のユーザーに push token を紐付ける。同じ token を持つ他のユーザーの紐付けは外れる';

revoke all on function public.register_push_token(text, text) from public, anon, authenticated;
grant execute on function public.register_push_token(text, text) to authenticated;
