import type { Database, Enums, Tables } from './database.types';

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
export type TagCategory = 'divination' | 'concern' | 'style';

// profile_private_details.gender の CHECK 制約と合わせる（「回答しない」は null）
export type Gender = 'female' | 'male' | 'other';

// search_tellers の並び順（DB の enum teller_sort_order）
export type TellerSortOrder = Enums<'teller_sort_order'>;

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

// 占い師詳細に出すレビュー（listTellerReviews の結果。レビューした相談者は匿名にするため reviewer_id を含めない）
export type TellerReview = Pick<Review, 'id' | 'rating' | 'comment' | 'created_at'>;

// やり取りタブの一覧に出すセッション（listMySessions の結果）。
// partner_name は相手（自分でない側）の表示名。プロフィールが見つからなければ null
export type SessionListItem = Pick<
  Session,
  | 'id'
  | 'applicant_id'
  | 'recipient_id'
  | 'consultant_id'
  | 'teller_id'
  | 'status'
  | 'concern'
  | 'expires_at'
  | 'updated_at'
> & {
  partner_name: string | null;
};

// セッション詳細に出すセッション（getSession の結果）。partner_name は SessionListItem と同じ
export type SessionDetail = Pick<
  Session,
  | 'id'
  | 'applicant_id'
  | 'recipient_id'
  | 'consultant_id'
  | 'teller_id'
  | 'initiated_by'
  | 'status'
  | 'concern'
  | 'applicant_message'
  | 'expires_at'
  | 'completed_at'
  | 'updated_at'
> & {
  partner_name: string | null;
};

// お悩み一覧・投稿の詳細に出す投稿（list_consultation_posts / get_consultation_post の結果の1行）。
// 投稿者を匿名にするため consultant_id を含まない。is_mine は自分の投稿か、has_applied は自分が応募済みか
export type ConsultationPostListItem =
  Database['public']['Functions']['list_consultation_posts']['Returns'][number];

// 自分のお悩み投稿（list_my_consultation_posts の結果の1行。閉じた投稿も含む）
export type MyConsultationPost =
  Database['public']['Functions']['list_my_consultation_posts']['Returns'][number];

// get_teller の結果（占い師詳細）。上書きの理由は TellerSearchResult と同じ
type GetTellerRow = Database['public']['Functions']['get_teller']['Returns'][number];
export type TellerDetail = Omit<
  GetTellerRow,
  'avatar_url' | 'self_pr' | 'training_period' | 'average_rating' | 'tags'
> & {
  avatar_url: string | null;
  self_pr: string | null;
  training_period: string | null;
  average_rating: number | null;
  tags: TellerTag[];
};
