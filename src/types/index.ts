import type { Database, Tables } from './database.types';

export type Profile = Tables<'profiles'>;
export type ProfilePrivateDetails = Tables<'profile_private_details'>;
export type TellerProfile = Tables<'teller_profiles'>;
export type ConsultationPost = Tables<'consultation_posts'>;
export type Session = Tables<'sessions'>;
export type Message = Tables<'messages'>;
export type Review = Tables<'reviews'>;
export type Notification = Tables<'notifications'>;
export type Favorite = Tables<'favorites'>;
export type Tag = Tables<'tags'>;
export type PushToken = Tables<'push_tokens'>;

// tags.category の CHECK 制約と合わせる
export type TagCategory = 'divination' | 'style';

// search_tellers の結果に入る、占い師のタグ
export type TellerTag = {
  slug: string;
  category: TagCategory;
  name: string;
};

// search_tellers の結果の1行。
// 関数の戻り値は型生成で NULL 可否が分からず、すべて非 NULL になるため、NULL になりうる列と tags を上書きする
type SearchTellersRow = Database['public']['Functions']['search_tellers']['Returns'][number];
export type TellerSearchResult = Omit<
  SearchTellersRow,
  'avatar_url' | 'self_pr' | 'training_period' | 'average_rating' | 'tags'
> & {
  avatar_url: string | null;
  self_pr: string | null;
  training_period: string | null;
  average_rating: number | null;
  tags: TellerTag[];
};
