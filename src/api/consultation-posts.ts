import { supabase } from '@/lib/supabase';
import type { ConsultationPostListItem, MyConsultationPost } from '@/types';

// お悩み投稿は投稿者を匿名にするため、consultation_posts を直接読めない（SELECT 権限が無い）。
// 読み取り・閉じる・応募は DB の関数を通す

// お悩み一覧（募集中・対応中の投稿を新着順）を取得する
export async function listConsultationPosts() {
  const { data, error } = await supabase.rpc('list_consultation_posts');

  return { data: data as ConsultationPostListItem[] | null, error };
}

// お悩み投稿1件を取得する。閉じた投稿は投稿者本人だけが取得できる。
// 見られない・存在しない ID なら data は null
export async function getConsultationPost(postId: string) {
  const { data, error } = await supabase
    .rpc('get_consultation_post', { p_post_id: postId })
    .maybeSingle();

  return { data: data as ConsultationPostListItem | null, error };
}

// 自分のお悩み投稿を、閉じたものも含めて新着順に取得する
export async function listMyConsultationPosts() {
  const { data, error } = await supabase.rpc('list_my_consultation_posts');

  return { data: data as MyConsultationPost[] | null, error };
}

type CreateConsultationPostParams = {
  consultantId: string;
  concernTagId: string;
  concern: string;
};

// お悩みを投稿する（ログイン中の自分の名義）。
// SELECT 権限が無いので .select() で作った行を読み返さない（付けると保存できてもエラーになる）。
// 悩みタグ以外のタグ・文字数の超過は DB のトリガーと CHECK が弾く
export async function createConsultationPost({
  consultantId,
  concernTagId,
  concern,
}: CreateConsultationPostParams) {
  const { error } = await supabase.from('consultation_posts').insert({
    consultant_id: consultantId,
    concern_tag_id: concernTagId,
    concern,
  });

  return { error };
}

// 自分のお悩み投稿を閉じる（閉じたあとは応募できない。進行中のセッションは続く）。
// 本人以外が閉じることは DB の close_consultation_post が弾く
export async function closeConsultationPost(postId: string) {
  const { error } = await supabase.rpc('close_consultation_post', { p_post_id: postId });

  return { error };
}

type ApplyToConsultationPostParams = {
  postId: string;
  message: string;
};

// 占い師としてお悩み投稿に応募する。data は作ったセッションの ID。ひとことが空なら null（未入力）で送る。
// 占い師でない・自分の投稿・閉じた投稿・同じ投稿への再応募・二重の申込み・文字数の超過は DB が弾く
export async function applyToConsultationPost({ postId, message }: ApplyToConsultationPostParams) {
  const { data, error } = await supabase.rpc('apply_to_consultation_post', {
    p_post_id: postId,
    // 型生成では関数の引数の NULL 可否が分からず string になるが、DB 側は null（未入力）を受け付ける
    p_applicant_message: (message || null) as string,
  });

  return { data, error };
}
