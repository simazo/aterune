import { supabase } from '@/lib/supabase';

type SendMessageParams = {
  sessionId: string;
  senderId: string;
  content: string;
};

// セッションのメッセージを古い順に取得する。読めるのは当事者だけ（RLS の messages_select_own）。
// API は1回に最大1000件（supabase/config.toml の max_rows）までしか返さないため、1000件を超えると新しい側が欠ける。
// 1回のやり取りでそこまで増えることは想定していない。必要になったら新しい順に件数を区切って取り、画面で並べ直す
export async function listMessages(sessionId: string) {
  return supabase
    .from('messages')
    .select('id, sender_id, content, created_at')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true });
}

// 自分（ログイン中のユーザー）名義でメッセージを送る。
// 進行中でないセッション・当事者でない人の送信は RLS（messages_insert_own）が、空白だけ・文字数の超過は CHECK が弾く
export async function sendMessage({ sessionId, senderId, content }: SendMessageParams) {
  const { error } = await supabase
    .from('messages')
    .insert({ session_id: sessionId, sender_id: senderId, content });

  return { error };
}
