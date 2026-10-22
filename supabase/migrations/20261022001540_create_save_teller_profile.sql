-- save_teller_profile: ログイン中のユーザーの占い師プロフィールを保存する(占い師登録と編集の両方で使う)。
-- 依存: public.teller_profiles、public.teller_tags、public.tags
--
-- teller_profiles の作成・更新と、teller_tags の入れ替え(全削除して入れ直す)を1回の呼び出しで行う。
-- 別々に呼ぶと、途中で失敗したときに「タグの無い占い師」が残るため、関数にまとめて1トランザクションにしている。
-- 占術(divination)タグが1つも無ければ例外にする(検索で見つからない占い師を作らないため)。
-- 存在しないタグが含まれていれば外部キー違反になり、全体が取り消される。
-- 自分の行の読み書きだけなので、security definer は付けず RLS をそのまま効かせる。
-- 未ログイン(auth.uid() が null)なら例外にする。

create function public.save_teller_profile(
  p_self_pr            text,
  p_training_period    text,
  p_requires_birthdate boolean,
  p_is_accepting       boolean,
  p_tag_ids            uuid[]
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
begin
  if v_user_id is null then
    raise exception 'ログインが必要です' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.tags
     where id = any (p_tag_ids)
       and category = 'divination'
  ) then
    raise exception '占術タグを1つ以上選んでください';
  end if;

  -- 集計値(average_rating など)は列に含めないので、更新しても元の値のまま残る
  insert into public.teller_profiles
    (profile_id, self_pr, training_period, requires_birthdate, is_accepting)
  values
    (v_user_id, p_self_pr, p_training_period, p_requires_birthdate, p_is_accepting)
  on conflict (profile_id) do update
    set self_pr            = excluded.self_pr,
        training_period    = excluded.training_period,
        requires_birthdate = excluded.requires_birthdate,
        is_accepting       = excluded.is_accepting;

  delete from public.teller_tags where teller_id = v_user_id;

  -- 同じタグが重複して渡されても主キー違反にならないよう distinct する
  insert into public.teller_tags (teller_id, tag_id)
  select distinct v_user_id, tag_id
    from unnest(p_tag_ids) as t (tag_id);
end;
$$;

comment on function public.save_teller_profile(text, text, boolean, boolean, uuid[]) is
  'ログイン中のユーザーの占い師プロフィールを作成・更新し、タグを渡したものに入れ替える。占術タグが1つも無ければ例外';

revoke all on function public.save_teller_profile(text, text, boolean, boolean, uuid[]) from public, anon, authenticated;
grant execute on function public.save_teller_profile(text, text, boolean, boolean, uuid[]) to authenticated;
