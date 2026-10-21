export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      consultation_posts: {
        Row: {
          category: string | null
          concern: string
          consultant_id: string
          created_at: string
          id: string
          status: string
          updated_at: string
        }
        Insert: {
          category?: string | null
          concern: string
          consultant_id: string
          created_at?: string
          id?: string
          status?: string
          updated_at?: string
        }
        Update: {
          category?: string | null
          concern?: string
          consultant_id?: string
          created_at?: string
          id?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      favorites: {
        Row: {
          consultant_id: string
          created_at: string
          teller_id: string
        }
        Insert: {
          consultant_id: string
          created_at?: string
          teller_id: string
        }
        Update: {
          consultant_id?: string
          created_at?: string
          teller_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "favorites_teller_id_fkey"
            columns: ["teller_id"]
            isOneToOne: false
            referencedRelation: "teller_profiles"
            referencedColumns: ["profile_id"]
          },
        ]
      }
      messages: {
        Row: {
          content: string
          created_at: string
          id: string
          sender_id: string
          session_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          sender_id: string
          session_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          sender_id?: string
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          is_read: boolean
          recipient_id: string
          session_id: string | null
          type: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean
          recipient_id: string
          session_id?: string | null
          type: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean
          recipient_id?: string
          session_id?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      profile_private_details: {
        Row: {
          birthdate: string | null
          created_at: string
          gender: string | null
          profile_id: string
          updated_at: string
        }
        Insert: {
          birthdate?: string | null
          created_at?: string
          gender?: string | null
          profile_id: string
          updated_at?: string
        }
        Update: {
          birthdate?: string | null
          created_at?: string
          gender?: string | null
          profile_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profile_private_details_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          active_mode: string
          avatar_url: string | null
          bio: string | null
          created_at: string
          display_name: string
          id: string
          is_teller: boolean
          updated_at: string
        }
        Insert: {
          active_mode?: string
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          display_name: string
          id: string
          is_teller?: boolean
          updated_at?: string
        }
        Update: {
          active_mode?: string
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          display_name?: string
          id?: string
          is_teller?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      push_tokens: {
        Row: {
          created_at: string
          expo_push_token: string
          id: string
          platform: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          expo_push_token: string
          id?: string
          platform?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          expo_push_token?: string
          id?: string
          platform?: string | null
          user_id?: string
        }
        Relationships: []
      }
      reviews: {
        Row: {
          comment: string | null
          created_at: string
          id: string
          rating: number
          reviewee_id: string
          reviewer_id: string
          session_id: string
        }
        Insert: {
          comment?: string | null
          created_at?: string
          id?: string
          rating: number
          reviewee_id: string
          reviewer_id: string
          session_id: string
        }
        Update: {
          comment?: string | null
          created_at?: string
          id?: string
          rating?: number
          reviewee_id?: string
          reviewer_id?: string
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviews_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: true
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      sessions: {
        Row: {
          applicant_id: string
          applicant_message: string | null
          category: string | null
          completed_at: string | null
          concern: string
          consultant_id: string
          created_at: string
          expires_at: string
          id: string
          initiated_by: string
          last_activity_at: string
          post_id: string | null
          recipient_id: string
          status: string
          teller_id: string
          updated_at: string
        }
        Insert: {
          applicant_id: string
          applicant_message?: string | null
          category?: string | null
          completed_at?: string | null
          concern: string
          consultant_id: string
          created_at?: string
          expires_at?: string
          id?: string
          initiated_by: string
          last_activity_at?: string
          post_id?: string | null
          recipient_id: string
          status?: string
          teller_id: string
          updated_at?: string
        }
        Update: {
          applicant_id?: string
          applicant_message?: string | null
          category?: string | null
          completed_at?: string | null
          concern?: string
          consultant_id?: string
          created_at?: string
          expires_at?: string
          id?: string
          initiated_by?: string
          last_activity_at?: string
          post_id?: string | null
          recipient_id?: string
          status?: string
          teller_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sessions_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "consultation_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_teller_id_fkey"
            columns: ["teller_id"]
            isOneToOne: false
            referencedRelation: "teller_profiles"
            referencedColumns: ["profile_id"]
          },
        ]
      }
      tags: {
        Row: {
          category: string
          id: string
          name: string
          slug: string
          sort_order: number
        }
        Insert: {
          category: string
          id?: string
          name: string
          slug: string
          sort_order?: number
        }
        Update: {
          category?: string
          id?: string
          name?: string
          slug?: string
          sort_order?: number
        }
        Relationships: []
      }
      teller_profiles: {
        Row: {
          average_rating: number | null
          created_at: string
          is_accepting: boolean
          profile_id: string
          requires_birthdate: boolean
          review_count: number
          self_pr: string | null
          session_count: number
          training_period: string | null
          updated_at: string
        }
        Insert: {
          average_rating?: number | null
          created_at?: string
          is_accepting?: boolean
          profile_id: string
          requires_birthdate?: boolean
          review_count?: number
          self_pr?: string | null
          session_count?: number
          training_period?: string | null
          updated_at?: string
        }
        Update: {
          average_rating?: number | null
          created_at?: string
          is_accepting?: boolean
          profile_id?: string
          requires_birthdate?: boolean
          review_count?: number
          self_pr?: string | null
          session_count?: number
          training_period?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "teller_profiles_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      teller_tags: {
        Row: {
          tag_id: string
          teller_id: string
        }
        Insert: {
          tag_id: string
          teller_id: string
        }
        Update: {
          tag_id?: string
          teller_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "teller_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teller_tags_teller_id_fkey"
            columns: ["teller_id"]
            isOneToOne: false
            referencedRelation: "teller_profiles"
            referencedColumns: ["profile_id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_teller: {
        Args: { p_teller_id: string }
        Returns: {
          avatar_url: string
          average_rating: number
          created_at: string
          display_name: string
          is_accepting: boolean
          requires_birthdate: boolean
          review_count: number
          self_pr: string
          session_count: number
          tags: Json
          teller_id: string
          training_period: string
        }[]
      }
      register_push_token: {
        Args: { p_platform: string; p_token: string }
        Returns: undefined
      }
      search_tellers: {
        Args: {
          p_accepting_only?: boolean
          p_sort?: Database["public"]["Enums"]["teller_sort_order"]
          p_tag_slugs?: string[]
        }
        Returns: {
          avatar_url: string
          average_rating: number
          display_name: string
          is_accepting: boolean
          review_count: number
          self_pr: string
          session_count: number
          tags: Json
          teller_id: string
          training_period: string
        }[]
      }
    }
    Enums: {
      teller_sort_order: "newest" | "rating" | "sessions"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      teller_sort_order: ["newest", "rating", "sessions"],
    },
  },
} as const

