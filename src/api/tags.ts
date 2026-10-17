import { supabase } from '@/lib/supabase';

// タグマスタを、種類 → 表示順の順で取得する
export async function listTags() {
  return supabase
    .from('tags')
    .select('id, category, slug, name')
    .order('category')
    .order('sort_order');
}
