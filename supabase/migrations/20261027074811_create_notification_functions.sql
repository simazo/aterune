-- 通知一覧と未読の件数(アプリ内の通知一覧・ベルのバッジ用)。
-- 依存: public.notifications、public.sessions、public.profiles
--
-- メッセージの受信(message_received)は、同じセッションのものを1行にまとめる(1通ごとに通知の行ができるため)。
-- それ以外の種類はまとめず、1件を1行にする。未読の件数は、まとめた後の行で数える。
-- 既読にする処理は関数にせず、アプリから notifications を update する(notifications_update_own の範囲)。
-- 本人宛ての通知・当事者のセッション・公開のプロフィールしか読まないため、security definer は付けず、
-- 既存の RLS(notifications_select_own、sessions_select_own、profiles_select_public)をそのまま効かせる。

-- まとめた後の通知の行(自分宛て)。2つの関数で同じまとめ方をするため、内部用の関数に分ける。
-- タップで開く先が無いため、セッションに紐づかない行(今のトリガーは作らない)は一覧にも件数にも入れない。
--   created_at   : まとめた行は最新の通知の時刻
--   unread_count : まとめた行の未読の件数(まとめない種類は 0 か 1)
create function public.list_grouped_notifications()
returns table (
  session_id   uuid,
  type         text,
  created_at   timestamptz,
  unread_count integer
)
language sql
stable
set search_path = ''
as $$
  select n.session_id, n.type, max(n.created_at), (count(*) filter (where not n.is_read))::integer
    from public.notifications n
   where n.recipient_id = (select auth.uid())
     and n.session_id is not null
     and n.type = 'message_received'
   group by n.session_id, n.type
  union all
  select n.session_id, n.type, n.created_at, (case when n.is_read then 0 else 1 end)
    from public.notifications n
   where n.recipient_id = (select auth.uid())
     and n.session_id is not null
     and n.type <> 'message_received';
$$;

comment on function public.list_grouped_notifications() is
  '自分宛ての通知を、message_received だけセッションごとに1行にまとめて返す(list_my_notifications・count_unread_notifications の内部用)';

-- 通知一覧: まとめた後の行を新しい順に50行返す(同じ時刻ならセッションID順)。
-- 相手=セッションの当事者のうち自分ではない側(send-push と同じ)。プロフィールが無ければ表示名・アイコンは null
create function public.list_my_notifications()
returns table (
  session_id           uuid,
  type                 text,
  created_at           timestamptz,
  unread_count         integer,
  partner_display_name text,
  partner_avatar_path  text
)
language sql
stable
set search_path = ''
as $$
  select g.session_id, g.type, g.created_at, g.unread_count, p.display_name, p.avatar_path
    from public.list_grouped_notifications() g
    join public.sessions s on s.id = g.session_id
    left join public.profiles p
      on p.id = case when s.consultant_id = (select auth.uid()) then s.teller_id else s.consultant_id end
   order by g.created_at desc, g.session_id
   limit 50;
$$;

comment on function public.list_my_notifications() is
  '自分宛ての通知を、message_received だけセッションごとに1行にまとめ、新しい順に50行返す(相手の表示名・アイコン付き)';

-- 未読の件数: まとめた後に未読が残っている行の数(一覧の50行の上限は掛けない)
create function public.count_unread_notifications()
returns integer
language sql
stable
set search_path = ''
as $$
  select count(*)::integer
    from public.list_grouped_notifications() g
   where g.unread_count > 0;
$$;

comment on function public.count_unread_notifications() is
  '自分宛ての通知のうち、message_received をセッションごとにまとめた後で未読が残っている行の数を返す';

revoke all on function public.list_grouped_notifications()  from public, anon, authenticated;
revoke all on function public.list_my_notifications()       from public, anon, authenticated;
revoke all on function public.count_unread_notifications()  from public, anon, authenticated;
grant execute on function public.list_grouped_notifications()  to authenticated;
grant execute on function public.list_my_notifications()       to authenticated;
grant execute on function public.count_unread_notifications()  to authenticated;
