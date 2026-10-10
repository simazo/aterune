-- push_tokens: 端末ごとの Expo プッシュ通知トークン。本人だけが読み・登録・削除できる。
-- 通知の送信(Edge Function)は service_role で全件を読む。
create table public.push_tokens (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users (id) on delete cascade,
  expo_push_token text not null check (btrim(expo_push_token) <> ''),
  platform        text check (platform in ('ios', 'android', 'web')),
  created_at      timestamptz not null default now(),
  -- この制約の索引が user_id 先頭なので、user_id 単独の索引は不要
  constraint push_tokens_user_id_expo_push_token_key unique (user_id, expo_push_token)
);

comment on table  public.push_tokens                  is '端末ごとの Expo プッシュ通知トークン';
comment on column public.push_tokens.id               is 'ID';
comment on column public.push_tokens.user_id          is 'トークンの持ち主のユーザーID';
comment on column public.push_tokens.expo_push_token  is 'Expo プッシュトークン';
comment on column public.push_tokens.platform         is '端末の種別(ios / android / web)';

alter table public.push_tokens enable row level security;

revoke all on public.push_tokens from anon, authenticated;
grant select, delete                                 on public.push_tokens to authenticated;
grant insert (user_id, expo_push_token, platform)    on public.push_tokens to authenticated;
grant all                                            on public.push_tokens to service_role;

create policy "push_tokens_select_own"
  on public.push_tokens for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "push_tokens_insert_own"
  on public.push_tokens for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "push_tokens_delete_own"
  on public.push_tokens for delete
  to authenticated
  using ((select auth.uid()) = user_id);