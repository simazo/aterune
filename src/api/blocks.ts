import { supabase } from '@/lib/supabase';
import type { BlockedUser } from '@/types';

// 主キー（blocker_id, blocked_id）の重複。すでにブロック済みのとき
const UNIQUE_VIOLATION = '23505';

// 自分がその相手をブロックしているかを取得する。
// 相手が自分をブロックしているかは RLS で読めず、分からない（ブロックされたことは知らせない仕様のため）
export async function isBlocking(userId: string, otherUserId: string) {
  const { data, error } = await supabase
    .from('blocks')
    .select('blocked_id')
    .eq('blocker_id', userId)
    .eq('blocked_id', otherUserId)
    .maybeSingle();

  return { data: data !== null, error };
}

// 相手をブロックする。
// ブロック済み（二度押し・別端末でのブロック）なら、目的の状態にはなっているので成功として返す
export async function blockUser(userId: string, otherUserId: string) {
  const { error } = await supabase
    .from('blocks')
    .insert({ blocker_id: userId, blocked_id: otherUserId });

  if (error?.code === UNIQUE_VIOLATION) return { error: null };
  return { error };
}

// 相手のブロックを解除する。
// ブロックが無く 0 件の削除になっても（二度押し・別端末での解除）エラーにはならず、成功として返る
export async function unblockUser(userId: string, otherUserId: string) {
  const { error } = await supabase
    .from('blocks')
    .delete()
    .eq('blocker_id', userId)
    .eq('blocked_id', otherUserId);

  return { error };
}

// 自分がブロックした相手の一覧を、ブロックの新しい順に取得する（退会した相手は除かれる）
export async function listBlockedUsers() {
  const { data, error } = await supabase.rpc('list_blocked_users');

  return { data: data as BlockedUser[] | null, error };
}
