-- reviews: 相談者 → 占い師の一方向の評価。1セッション1回、投稿後の編集・削除は不可。
create table public.reviews (
  id          uuid primary key default gen_random_uuid(),
  session_id  uuid not null unique references public.sessions (id) on delete cascade,
  reviewer_id uuid not null references auth.users (id) on delete cascade,
  reviewee_id uuid not null references auth.users (id) on delete cascade,
  rating      smallint not null check (rating between 1 and 5),
  comment     text,
  created_at  timestamptz not null default now(),
  constraint reviews_no_self_review check (reviewer_id <> reviewee_id)
);

comment on table  public.reviews             is '相談者から占い師への評価(一方向)';
comment on column public.reviews.id          is '評価ID';
comment on column public.reviews.session_id  is '対象セッションID(1セッション1レビューまで、unique制約あり)';
comment on column public.reviews.reviewer_id is '評価した側のユーザーID(常に相談者)';
comment on column public.reviews.reviewee_id is '評価された側のユーザーID(常にセッションの占い師)';
comment on column public.reviews.rating      is '評価点(1〜5の整数)';
comment on column public.reviews.comment     is '評価コメント(任意)';
comment on column public.reviews.created_at  is '投稿日時。sessions.completed_at から7日以内のみ投稿可能。投稿後の編集・削除は不可';

-- 占い師ごとの評価の集計・一覧用(session_id の索引は UNIQUE 制約が兼ねる)
create index reviews_reviewee_id_idx on public.reviews (reviewee_id);

-- 評価の増減に合わせて、teller_profiles の評価キャッシュ(平均・件数)を再計算する。
-- 削除でも動かすのは、セッション/ユーザーの連鎖削除でレビューが消えた場合に備えるため。
create function public.update_teller_rating_cache()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_teller uuid := case when tg_op = 'DELETE' then old.reviewee_id else new.reviewee_id end;
begin
  update public.teller_profiles
     set average_rating = (select avg(rating) from public.reviews where reviewee_id = v_teller),
         review_count   = (select count(*)    from public.reviews where reviewee_id = v_teller)
   where profile_id = v_teller;
  return null; -- AFTER トリガーなので戻り値は使われない
end;
$$;

revoke all on function public.update_teller_rating_cache() from public, anon, authenticated;

create trigger reviews_update_teller_rating
  after insert or delete on public.reviews
  for each row execute function public.update_teller_rating_cache();

alter table public.reviews enable row level security;

revoke all on public.reviews from anon, authenticated;
grant select on public.reviews to anon, authenticated;
grant insert (session_id, reviewer_id, reviewee_id, rating, comment) on public.reviews to authenticated;
grant all on public.reviews to service_role;

-- 評価は公開情報
create policy "reviews_select_public"
  on public.reviews for select
  to anon, authenticated
  using (true);

-- 投稿できるのは、そのセッションの相談者が、担当の占い師に対して、
-- 相談者の完了操作(completed)から7日以内に限る。auto_completed は不可。
create policy "reviews_insert_own"
  on public.reviews for insert
  to authenticated
  with check (
    reviewer_id = (select auth.uid())
    and exists (
      select 1 from public.sessions s
       where s.id = reviews.session_id
         and s.consultant_id = (select auth.uid())
         and s.teller_id = reviews.reviewee_id
         and s.status = 'completed'
         and s.completed_at >= now() - interval '7 days'
    )
  );

-- update / delete のポリシーと GRANT は意図的に設けない(編集・削除不可)