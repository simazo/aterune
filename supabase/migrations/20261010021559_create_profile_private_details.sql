-- profile_private_details: 生年月日・性別などの非公開情報(profiles と 1:1)。
-- 本人は読み書きできる。占い師は、セッションの相談者の情報だけを、条件付きで読める。
create table public.profile_private_details (
  profile_id uuid primary key references public.profiles (id) on delete cascade,
  birthdate  date,
  gender     text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table  public.profile_private_details            is '非公開のプロフィール情報(profiles と 1:1)';
comment on column public.profile_private_details.profile_id is '対象ユーザーID(profiles と 1:1)';
comment on column public.profile_private_details.birthdate  is '生年月日(非公開。セッションの相手の占い師にのみ、条件付きで開示される)';
comment on column public.profile_private_details.gender     is '性別(非公開)';

create trigger set_updated_at
  before update on public.profile_private_details
  for each row execute function public.set_updated_at();

alter table public.profile_private_details enable row level security;

revoke all on public.profile_private_details from anon, authenticated;
grant select on public.profile_private_details to authenticated;
grant insert (profile_id, birthdate, gender) on public.profile_private_details to authenticated;
grant update (birthdate, gender)             on public.profile_private_details to authenticated;
grant all on public.profile_private_details to service_role;

-- 本人は自分の行を読める
create policy "profile_private_details_select_own"
  on public.profile_private_details for select
  to authenticated
  using ((select auth.uid()) = profile_id);

-- 占い師は、そのセッションの相談者の情報を読める(相談者の同意がある状態に限る)。
--   ・相談者が自分から申し込んだ pending
--   ・承認後(active)と、完了後(completed / auto_completed)
-- 占い師から応募した pending(相談者が未承認)と、rejected / expired は読めない。
create policy "profile_private_details_select_teller_of_session"
  on public.profile_private_details for select
  to authenticated
  using (
    exists (
      select 1 from public.sessions s
       where s.teller_id = (select auth.uid())
         and s.consultant_id = profile_private_details.profile_id
         and (
           s.status in ('active', 'completed', 'auto_completed')
           or (s.status = 'pending' and s.initiated_by = 'consultant')
         )
    )
  );

create policy "profile_private_details_insert_own"
  on public.profile_private_details for insert
  to authenticated
  with check ((select auth.uid()) = profile_id);

create policy "profile_private_details_update_own"
  on public.profile_private_details for update
  to authenticated
  using      ((select auth.uid()) = profile_id)
  with check ((select auth.uid()) = profile_id);