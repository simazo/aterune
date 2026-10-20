import { supabase } from '@/lib/supabase';

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
