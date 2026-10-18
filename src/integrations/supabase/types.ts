export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      account_deletion_requests: {
        Row: {
          completed_at: string | null
          created_at: string
          email: string | null
          expires_at: string
          id: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          token_hash: string | null
          user_id: string | null
          verified_at: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          email?: string | null
          expires_at: string
          id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          token_hash?: string | null
          user_id?: string | null
          verified_at?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          email?: string | null
          expires_at?: string
          id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          token_hash?: string | null
          user_id?: string | null
          verified_at?: string | null
        }
        Relationships: []
      }
      announcements: {
        Row: {
          body: string
          created_at: string
          created_by: string | null
          id: string
          title: string
        }
        Insert: {
          body: string
          created_at?: string
          created_by?: string | null
          id?: string
          title: string
        }
        Update: {
          body?: string
          created_at?: string
          created_by?: string | null
          id?: string
          title?: string
        }
        Relationships: []
      }
      content_reports: {
        Row: {
          content_id: string
          content_preview: string | null
          content_type: string
          created_at: string
          id: string
          reason: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content_id: string
          content_preview?: string | null
          content_type: string
          created_at?: string
          id?: string
          reason: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content_id?: string
          content_preview?: string | null
          content_type?: string
          created_at?: string
          id?: string
          reason?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      flashcards: {
        Row: {
          auto_generated: boolean
          back: string
          created_at: string
          front: string
          id: string
          subject_id: string
          topic: string | null
        }
        Insert: {
          auto_generated?: boolean
          back: string
          created_at?: string
          front: string
          id?: string
          subject_id: string
          topic?: string | null
        }
        Update: {
          auto_generated?: boolean
          back?: string
          created_at?: string
          front?: string
          id?: string
          subject_id?: string
          topic?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "flashcards_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      match_pairs: {
        Row: {
          auto_generated: boolean
          created_at: string
          id: string
          left_text: string
          right_text: string
          subject_id: string
          topic: string | null
        }
        Insert: {
          auto_generated?: boolean
          created_at?: string
          id?: string
          left_text: string
          right_text: string
          subject_id: string
          topic?: string | null
        }
        Update: {
          auto_generated?: boolean
          created_at?: string
          id?: string
          left_text?: string
          right_text?: string
          subject_id?: string
          topic?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "match_pairs_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      pending_content: {
        Row: {
          ai_check: Json | null
          answer: string | null
          batch_id: string
          correct_index: number | null
          created_at: string
          difficulty: number
          explanation: string | null
          id: string
          kind: string
          options: Json | null
          prompt: string
          reviewed_by: string | null
          status: string
          subject_id: string
          topic: string | null
          updated_at: string
        }
        Insert: {
          ai_check?: Json | null
          answer?: string | null
          batch_id?: string
          correct_index?: number | null
          created_at?: string
          difficulty?: number
          explanation?: string | null
          id?: string
          kind?: string
          options?: Json | null
          prompt: string
          reviewed_by?: string | null
          status?: string
          subject_id: string
          topic?: string | null
          updated_at?: string
        }
        Update: {
          ai_check?: Json | null
          answer?: string | null
          batch_id?: string
          correct_index?: number | null
          created_at?: string
          difficulty?: number
          explanation?: string | null
          id?: string
          kind?: string
          options?: Json | null
          prompt?: string
          reviewed_by?: string | null
          status?: string
          subject_id?: string
          topic?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pending_content_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          approved: boolean
          approved_at: string | null
          approved_by: string | null
          avatar_url: string | null
          ban_reason: string | null
          banned_until: string | null
          created_at: string
          deletion_pending: boolean
          email: string | null
          full_name: string | null
          gender: string | null
          hide_surname: boolean
          id: string
          last_active: string | null
          must_change_password: boolean
          points: number
          streak: number
          updated_at: string
        }
        Insert: {
          approved?: boolean
          approved_at?: string | null
          approved_by?: string | null
          avatar_url?: string | null
          ban_reason?: string | null
          banned_until?: string | null
          created_at?: string
          deletion_pending?: boolean
          email?: string | null
          full_name?: string | null
          gender?: string | null
          hide_surname?: boolean
          id: string
          last_active?: string | null
          must_change_password?: boolean
          points?: number
          streak?: number
          updated_at?: string
        }
        Update: {
          approved?: boolean
          approved_at?: string | null
          approved_by?: string | null
          avatar_url?: string | null
          ban_reason?: string | null
          banned_until?: string | null
          created_at?: string
          deletion_pending?: boolean
          email?: string | null
          full_name?: string | null
          gender?: string | null
          hide_surname?: boolean
          id?: string
          last_active?: string | null
          must_change_password?: boolean
          points?: number
          streak?: number
          updated_at?: string
        }
        Relationships: []
      }
      progress_events: {
        Row: {
          content_id: string | null
          created_at: string
          id: string
          is_correct: boolean | null
          kind: string
          points: number
          subject_id: string | null
          topic: string | null
          user_id: string
        }
        Insert: {
          content_id?: string | null
          created_at?: string
          id?: string
          is_correct?: boolean | null
          kind: string
          points?: number
          subject_id?: string | null
          topic?: string | null
          user_id: string
        }
        Update: {
          content_id?: string | null
          created_at?: string
          id?: string
          is_correct?: boolean | null
          kind?: string
          points?: number
          subject_id?: string | null
          topic?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "progress_events_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      push_tokens: {
        Row: {
          created_at: string
          id: string
          token: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          token: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          token?: string
          user_id?: string
        }
        Relationships: []
      }
      questions: {
        Row: {
          auto_generated: boolean
          correct_index: number
          created_at: string
          difficulty: number
          explanation: string | null
          id: string
          options: Json
          prompt: string
          subject_id: string
          topic: string | null
        }
        Insert: {
          auto_generated?: boolean
          correct_index?: number
          created_at?: string
          difficulty?: number
          explanation?: string | null
          id?: string
          options: Json
          prompt: string
          subject_id: string
          topic?: string | null
        }
        Update: {
          auto_generated?: boolean
          correct_index?: number
          created_at?: string
          difficulty?: number
          explanation?: string | null
          id?: string
          options?: Json
          prompt?: string
          subject_id?: string
          topic?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "questions_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      subjects: {
        Row: {
          color: string
          created_at: string
          description: string | null
          id: string
          name: string
          slug: string
          sort_order: number
        }
        Insert: {
          color?: string
          created_at?: string
          description?: string | null
          id?: string
          name: string
          slug: string
          sort_order?: number
        }
        Update: {
          color?: string
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          slug?: string
          sort_order?: number
        }
        Relationships: []
      }
      site_settings: {
        Row: {
          id: number
          maintenance_enabled: boolean
          maintenance_title: string
          maintenance_message: string
          updated_at: string
        }
        Insert: {
          id?: number
          maintenance_enabled?: boolean
          maintenance_title?: string
          maintenance_message?: string
          updated_at?: string
        }
        Update: {
          id?: number
          maintenance_enabled?: boolean
          maintenance_title?: string
          maintenance_message?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_login_events: {
        Row: {
          id: string
          logged_in_at: string
          user_id: string
        }
        Insert: {
          id?: string
          logged_in_at?: string
          user_id: string
        }
        Update: {
          id?: string
          logged_in_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_messages: {
        Row: {
          body: string
          created_at: string
          id: string
          read_at: string | null
          sender_id: string | null
          subject: string
          updated_at: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          read_at?: string | null
          sender_id?: string | null
          subject: string
          updated_at?: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          read_at?: string | null
          sender_id?: string | null
          subject?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_admin_user_activity: {
        Args: { _since: string }
        Returns: {
          activity_count: number
          email: string | null
          full_name: string | null
          last_activity_at: string | null
          last_activity_kind: string | null
          last_login_at: string | null
          user_id: string
        }[]
      }
      get_leaderboard: {
        Args: { _limit?: number }
        Returns: {
          avatar_url: string
          full_name: string
          id: string
          points: number
          streak: number
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "super_admin" | "admin" | "student"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["super_admin", "admin", "student"],
    },
  },
} as const
