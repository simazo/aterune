import type { Tables } from './database.types';

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
