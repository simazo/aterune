import { supabase } from '@/lib/supabase';
import type { SessionDetail, SessionListItem } from '@/types';

// 承認・拒否で、更新できる承認待ちの行が無かったとき（相手が先に処理した、すでに処理済みなど）のエラー文
export const SESSION_ALREADY_HANDLED_MESSAGE = 'the session request has already been handled';

type CreateSessionRequestParams = {
  consultantId: string;
  tellerId: string;
  concern: string;
  message: string;
};

// 相談者（ログイン中の自分）から占い師へセッションを申し込む。
// 受付停止中・生年月日の未登録・二重の申込み・文字数の超過は DB のトリガーと CHECK が弾く
export async function createSessionRequest({
  consultantId,
  tellerId,
  concern,
  message,
}: CreateSessionRequestParams) {
  const { error } = await supabase.from('sessions').insert({
    applicant_id: consultantId,
    recipient_id: tellerId,
    consultant_id: consultantId,
    teller_id: tellerId,
    initiated_by: 'consultant',
    concern,
    applicant_message: message || null,
  });

  return { error };
}

// 自分（相談者）とその占い師の間に、進行中か期限内の承認待ちのセッションがあるか（占い師詳細の「申込み済み」の判定）。
// 条件は DB の check_session_request（二重の申込みの判定）と揃える。
// 期限は端末の時計で比べるため、DB の now() とずれると期限ぎりぎりの申込みで判定が食い違うことがある
// （その場合も申込みは DB が弾くので、データは不整合にならない）
export async function hasOpenSessionWithTeller(consultantId: string, tellerId: string) {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('sessions')
    .select('id')
    .eq('consultant_id', consultantId)
    .eq('teller_id', tellerId)
    .or(`status.eq.active,and(status.eq.pending,expires_at.gt.${now})`)
    .limit(1);

  return { data: data ? data.length > 0 : null, error };
}

// 自分が申込んだ側か申込まれた側のセッション（やり取りタブの一覧）を、更新の新しい順に取得する。
// sessions の外部キーは auth.users を指していて profiles と結合できないため、相手の表示名は profiles から別に取る
export async function listMySessions(
  userId: string
): Promise<{ data: SessionListItem[] | null; error: unknown }> {
  const { data: sessions, error } = await supabase
    .from('sessions')
    .select(
      'id, applicant_id, recipient_id, consultant_id, teller_id, status, concern, expires_at, updated_at'
    )
    .or(`applicant_id.eq.${userId},recipient_id.eq.${userId}`)
    .order('updated_at', { ascending: false });

  if (error) return { data: null, error };
  if (sessions.length === 0) return { data: [], error: null };

  const partnerIdOf = (s: (typeof sessions)[number]) =>
    s.applicant_id === userId ? s.recipient_id : s.applicant_id;
  const partnerIds = [...new Set(sessions.map(partnerIdOf))];

  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select('id, display_name')
    .in('id', partnerIds);

  if (profilesError) return { data: null, error: profilesError };

  const nameById = new Map(profiles.map((p) => [p.id, p.display_name]));
  return {
    data: sessions.map((s) => ({ ...s, partner_name: nameById.get(partnerIdOf(s)) ?? null })),
    error: null,
  };
}

// セッションを1件（セッション詳細）取得し、相手（自分でない側）の表示名を付ける。
// 見つからない・RLS で読めない（自分のセッションでない）ときは single() がエラーを返す
export async function getSession(
  sessionId: string,
  userId: string
): Promise<{ data: SessionDetail | null; error: unknown }> {
  const { data: session, error } = await supabase
    .from('sessions')
    .select(
      'id, applicant_id, recipient_id, consultant_id, teller_id, initiated_by, status, concern, applicant_message, expires_at, updated_at'
    )
    .eq('id', sessionId)
    .single();

  if (error) return { data: null, error };

  const partnerId = session.applicant_id === userId ? session.recipient_id : session.applicant_id;
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('display_name')
    .eq('id', partnerId)
    .maybeSingle();

  if (profileError) return { data: null, error: profileError };

  return { data: { ...session, partner_name: profile?.display_name ?? null }, error: null };
}

// 承認待ちのセッションの status を変える。承認待ちの条件を付けて更新し、更新した行が無ければ処理済みのエラーにする
// （RLS の update は対象の行が無くてもエラーにならないため）。
// 申込まれた側以外の操作・期限切れの承認は DB のトリガー（guard_session_status_change）が弾く
async function updatePendingSessionStatus(sessionId: string, status: 'active' | 'rejected') {
  const { data, error } = await supabase
    .from('sessions')
    .update({ status })
    .eq('id', sessionId)
    .eq('status', 'pending')
    .select('id');

  if (error) return { error };
  if (data.length === 0) return { error: { message: SESSION_ALREADY_HANDLED_MESSAGE } };
  return { error: null };
}

// 申込みを承認する（申込まれた側だけ）
export async function approveSession(sessionId: string) {
  return updatePendingSessionStatus(sessionId, 'active');
}

// 申込みを拒否する（申込まれた側だけ）
export async function rejectSession(sessionId: string) {
  return updatePendingSessionStatus(sessionId, 'rejected');
}
