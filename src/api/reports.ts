import { supabase } from '@/lib/supabase';
import type { ReportReason } from '@/types';

type ReportUserParams = {
  reporterId: string;
  reportedUserId: string;
  // セッション詳細から通報したときのセッションID。占い師詳細からなら null
  sessionId: string | null;
  reason: ReportReason;
  detail: string;
};

// 相手を運営に通報する。
// 利用者は通報を読めない（select の権限が無い）ため、insert のあとに select() を付けない（付けると失敗する）。
// セッションの当事者か・自分自身でないかは DB（トリガー・CHECK）が確かめる
export async function reportUser({
  reporterId,
  reportedUserId,
  sessionId,
  reason,
  detail,
}: ReportUserParams) {
  const { error } = await supabase.from('reports').insert({
    reporter_id: reporterId,
    reported_user_id: reportedUserId,
    session_id: sessionId,
    reason,
    detail: detail || null,
  });

  return { error };
}
