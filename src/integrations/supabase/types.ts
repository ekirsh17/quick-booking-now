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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      appointment_type_presets: {
        Row: {
          color_token: string | null
          created_at: string | null
          id: string
          is_default: boolean
          label: string | null
          merchant_id: string
          position: number
          updated_at: string
        }
        Insert: {
          color_token?: string | null
          created_at?: string | null
          id?: string
          is_default?: boolean
          label?: string | null
          merchant_id: string
          position?: number
          updated_at?: string
        }
        Update: {
          color_token?: string | null
          created_at?: string | null
          id?: string
          is_default?: boolean
          label?: string | null
          merchant_id?: string
          position?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointment_type_presets_profile_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      consumers: {
        Row: {
          created_at: string | null
          email: string | null
          id: string
          name: string | null
          phone: string | null
          profile_id: string | null
          saved_info: boolean | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          id?: string
          name?: string | null
          phone?: string | null
          profile_id?: string | null
          saved_info?: boolean | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string | null
          id?: string
          name?: string | null
          phone?: string | null
          profile_id?: string | null
          saved_info?: boolean | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "consumers_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      duration_presets: {
        Row: {
          color_token: string | null
          created_at: string | null
          duration_minutes: number | null
          id: string
          is_default: boolean
          label: string | null
          merchant_id: string
          position: number
          updated_at: string
        }
        Insert: {
          color_token?: string | null
          created_at?: string | null
          duration_minutes?: number | null
          id?: string
          is_default?: boolean
          label?: string | null
          merchant_id: string
          position?: number
          updated_at?: string
        }
        Update: {
          color_token?: string | null
          created_at?: string | null
          duration_minutes?: number | null
          id?: string
          is_default?: boolean
          label?: string | null
          merchant_id?: string
          position?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "duration_presets_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      external_calendar_accounts: {
        Row: {
          access_token: string | null
          connected_at: string | null
          created_at: string | null
          email: string | null
          encrypted_credentials: string | null
          id: string
          merchant_id: string | null
          meta: Json | null
          provider: string | null
          refresh_token: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          access_token?: string | null
          connected_at?: string | null
          created_at?: string | null
          email?: string | null
          encrypted_credentials?: string | null
          id?: string
          merchant_id?: string | null
          meta?: Json | null
          provider?: string | null
          refresh_token?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          access_token?: string | null
          connected_at?: string | null
          created_at?: string | null
          email?: string | null
          encrypted_credentials?: string | null
          id?: string
          merchant_id?: string | null
          meta?: Json | null
          provider?: string | null
          refresh_token?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "external_calendar_accounts_profile_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      external_calendar_events: {
        Row: {
          account_id: string
          calendar_id: string
          created_at: string
          error: string | null
          external_event_id: string
          external_event_key: string
          id: string
          last_synced_at: string
          slot_id: string
          status: Database["public"]["Enums"]["calendar_event_status"]
          updated_at: string
        }
        Insert: {
          account_id: string
          calendar_id: string
          created_at?: string
          error?: string | null
          external_event_id: string
          external_event_key: string
          id?: string
          last_synced_at?: string
          slot_id: string
          status?: Database["public"]["Enums"]["calendar_event_status"]
          updated_at?: string
        }
        Update: {
          account_id?: string
          calendar_id?: string
          created_at?: string
          error?: string | null
          external_event_id?: string
          external_event_key?: string
          id?: string
          last_synced_at?: string
          slot_id?: string
          status?: Database["public"]["Enums"]["calendar_event_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "external_calendar_events_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "external_calendar_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "external_calendar_events_slot_id_fkey"
            columns: ["slot_id"]
            isOneToOne: false
            referencedRelation: "public_open_slots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "external_calendar_events_slot_id_fkey"
            columns: ["slot_id"]
            isOneToOne: false
            referencedRelation: "slots"
            referencedColumns: ["id"]
          },
        ]
      }
      external_calendar_links: {
        Row: {
          account_id: string
          calendar_id: string
          calendar_name: string
          created_at: string
          id: string
          is_default: boolean
          updated_at: string
        }
        Insert: {
          account_id: string
          calendar_id: string
          calendar_name: string
          created_at?: string
          id?: string
          is_default?: boolean
          updated_at?: string
        }
        Update: {
          account_id?: string
          calendar_id?: string
          calendar_name?: string
          created_at?: string
          id?: string
          is_default?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "external_calendar_links_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "external_calendar_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      inbound_numbers: {
        Row: {
          created_at: string | null
          merchant_id: string | null
          to_number: string
        }
        Insert: {
          created_at?: string | null
          merchant_id?: string | null
          to_number: string
        }
        Update: {
          created_at?: string | null
          merchant_id?: string | null
          to_number?: string
        }
        Relationships: [
          {
            foreignKeyName: "inbound_numbers_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_idempotency: {
        Row: {
          created_at: string | null
          id: string
          key: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          key?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          key?: string | null
        }
        Relationships: []
      }
      notifications: {
        Row: {
          consumer_id: string | null
          id: string
          merchant_id: string | null
          message: string | null
          recipient: string | null
          sent_at: string | null
          slot_id: string | null
          status: string | null
          type: string | null
        }
        Insert: {
          consumer_id?: string | null
          id?: string
          merchant_id?: string | null
          message?: string | null
          recipient?: string | null
          sent_at?: string | null
          slot_id?: string | null
          status?: string | null
          type?: string | null
        }
        Update: {
          consumer_id?: string | null
          id?: string
          merchant_id?: string | null
          message?: string | null
          recipient?: string | null
          sent_at?: string | null
          slot_id?: string | null
          status?: string | null
          type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notifications_consumer_id_fkey"
            columns: ["consumer_id"]
            isOneToOne: false
            referencedRelation: "consumers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_slot_id_fkey"
            columns: ["slot_id"]
            isOneToOne: false
            referencedRelation: "public_open_slots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_slot_id_fkey"
            columns: ["slot_id"]
            isOneToOne: false
            referencedRelation: "slots"
            referencedColumns: ["id"]
          },
        ]
      }
      notify_requests: {
        Row: {
          consumer_id: string | null
          created_at: string | null
          id: string
          merchant_id: string
          slot_id: string | null
          time_range: string
        }
        Insert: {
          consumer_id?: string | null
          created_at?: string | null
          id?: string
          merchant_id: string
          slot_id?: string | null
          time_range?: string
        }
        Update: {
          consumer_id?: string | null
          created_at?: string | null
          id?: string
          merchant_id?: string
          slot_id?: string | null
          time_range?: string
        }
        Relationships: [
          {
            foreignKeyName: "notify_requests_consumer_id_fkey"
            columns: ["consumer_id"]
            isOneToOne: false
            referencedRelation: "consumers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notify_requests_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notify_requests_slot_id_fkey"
            columns: ["slot_id"]
            isOneToOne: false
            referencedRelation: "public_open_slots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notify_requests_slot_id_fkey"
            columns: ["slot_id"]
            isOneToOne: false
            referencedRelation: "slots"
            referencedColumns: ["id"]
          },
        ]
      }
      oauth_transactions: {
        Row: {
          access_token: string | null
          created_at: string | null
          id: string
          profile_id: string | null
          provider: string | null
          refresh_token: string | null
        }
        Insert: {
          access_token?: string | null
          created_at?: string | null
          id?: string
          profile_id?: string | null
          provider?: string | null
          refresh_token?: string | null
        }
        Update: {
          access_token?: string | null
          created_at?: string | null
          id?: string
          profile_id?: string | null
          provider?: string | null
          refresh_token?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "oauth_transactions_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      otp_codes: {
        Row: {
          attempts: number | null
          code: string | null
          created_at: string | null
          expires_at: string | null
          id: string
          phone: string | null
          verified: boolean | null
        }
        Insert: {
          attempts?: number | null
          code?: string | null
          created_at?: string | null
          expires_at?: string | null
          id?: string
          phone?: string | null
          verified?: boolean | null
        }
        Update: {
          attempts?: number | null
          code?: string | null
          created_at?: string | null
          expires_at?: string | null
          id?: string
          phone?: string | null
          verified?: boolean | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          address: string | null
          booking_url: string | null
          business_name: string | null
          created_at: string | null
          default_opening_duration: number | null
          id: string
          name: string | null
          onboarding_completed_at: string | null
          onboarding_step: number | null
          phone: string | null
          require_confirmation: boolean | null
          time_zone: string | null
          use_booking_system: boolean | null
          working_hours: Json | null
        }
        Insert: {
          address?: string | null
          booking_url?: string | null
          business_name?: string | null
          created_at?: string | null
          default_opening_duration?: number | null
          id?: string
          name?: string | null
          onboarding_completed_at?: string | null
          onboarding_step?: number | null
          phone?: string | null
          require_confirmation?: boolean | null
          time_zone?: string | null
          use_booking_system?: boolean | null
          working_hours?: Json | null
        }
        Update: {
          address?: string | null
          booking_url?: string | null
          business_name?: string | null
          created_at?: string | null
          default_opening_duration?: number | null
          id?: string
          name?: string | null
          onboarding_completed_at?: string | null
          onboarding_step?: number | null
          phone?: string | null
          require_confirmation?: boolean | null
          time_zone?: string | null
          use_booking_system?: boolean | null
          working_hours?: Json | null
        }
        Relationships: []
      }
      qr_code_scans: {
        Row: {
          id: string
          qr_code_id: string | null
          scanned_at: string | null
        }
        Insert: {
          id?: string
          qr_code_id?: string | null
          scanned_at?: string | null
        }
        Update: {
          id?: string
          qr_code_id?: string | null
          scanned_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "qr_code_scans_qr_code_id_fkey"
            columns: ["qr_code_id"]
            isOneToOne: false
            referencedRelation: "qr_codes"
            referencedColumns: ["id"]
          },
        ]
      }
      qr_codes: {
        Row: {
          code: string | null
          created_at: string | null
          id: string
          merchant_id: string | null
        }
        Insert: {
          code?: string | null
          created_at?: string | null
          id?: string
          merchant_id?: string | null
        }
        Update: {
          code?: string | null
          created_at?: string | null
          id?: string
          merchant_id?: string | null
        }
        Relationships: []
      }
      slots: {
        Row: {
          appointment_type: string | null
          created_at: string | null
          created_via: Database["public"]["Enums"]["slot_created_via"] | null
          end_time: string | null
          id: string
          merchant_id: string | null
          notes: string | null
          staff_id: string | null
          start_time: string | null
          status: string | null
          time_zone: string | null
        }
        Insert: {
          appointment_type?: string | null
          created_at?: string | null
          created_via?: Database["public"]["Enums"]["slot_created_via"] | null
          end_time?: string | null
          id?: string
          merchant_id?: string | null
          notes?: string | null
          staff_id?: string | null
          start_time?: string | null
          status?: string | null
          time_zone?: string | null
        }
        Update: {
          appointment_type?: string | null
          created_at?: string | null
          created_via?: Database["public"]["Enums"]["slot_created_via"] | null
          end_time?: string | null
          id?: string
          merchant_id?: string | null
          notes?: string | null
          staff_id?: string | null
          start_time?: string | null
          status?: string | null
          time_zone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "slots_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "slots_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      sms_intake_logs: {
        Row: {
          clarification_question: string | null
          confidence: number | null
          created_at: string | null
          error_message: string | null
          from_number: string
          id: string
          merchant_id: string | null
          needs_clarification: boolean | null
          opening_id: string | null
          operation: string | null
          parsed_json: Json | null
          processing_time_ms: number | null
          raw_message: string
        }
        Insert: {
          clarification_question?: string | null
          confidence?: number | null
          created_at?: string | null
          error_message?: string | null
          from_number: string
          id?: string
          merchant_id?: string | null
          needs_clarification?: boolean | null
          opening_id?: string | null
          operation?: string | null
          parsed_json?: Json | null
          processing_time_ms?: number | null
          raw_message: string
        }
        Update: {
          clarification_question?: string | null
          confidence?: number | null
          created_at?: string | null
          error_message?: string | null
          from_number?: string
          id?: string
          merchant_id?: string | null
          needs_clarification?: boolean | null
          opening_id?: string | null
          operation?: string | null
          parsed_json?: Json | null
          processing_time_ms?: number | null
          raw_message?: string
        }
        Relationships: [
          {
            foreignKeyName: "sms_intake_logs_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sms_intake_logs_opening_id_fkey"
            columns: ["opening_id"]
            isOneToOne: false
            referencedRelation: "public_open_slots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sms_intake_logs_opening_id_fkey"
            columns: ["opening_id"]
            isOneToOne: false
            referencedRelation: "slots"
            referencedColumns: ["id"]
          },
        ]
      }
      sms_intake_state: {
        Row: {
          context: Json
          created_at: string | null
          expires_at: string
          from_number: string
          id: string
          merchant_id: string
          round: number
        }
        Insert: {
          context: Json
          created_at?: string | null
          expires_at: string
          from_number: string
          id?: string
          merchant_id: string
          round?: number
        }
        Update: {
          context?: Json
          created_at?: string | null
          expires_at?: string
          from_number?: string
          id?: string
          merchant_id?: string
          round?: number
        }
        Relationships: [
          {
            foreignKeyName: "sms_intake_state_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      sms_logs: {
        Row: {
          body: string | null
          created_at: string | null
          from_number: string | null
          id: string
          to_number: string | null
        }
        Insert: {
          body?: string | null
          created_at?: string | null
          from_number?: string | null
          id?: string
          to_number?: string | null
        }
        Update: {
          body?: string | null
          created_at?: string | null
          from_number?: string | null
          id?: string
          to_number?: string | null
        }
        Relationships: []
      }
      staff: {
        Row: {
          created_at: string | null
          id: string
          merchant_id: string | null
          name: string | null
          phone: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          merchant_id?: string | null
          name?: string | null
          phone?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          merchant_id?: string | null
          name?: string | null
          phone?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          profile_id: string | null
          role: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          profile_id?: string | null
          role?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          profile_id?: string | null
          role?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      public_open_slots: {
        Row: {
          appointment_type: string | null
          created_at: string | null
          end_time: string | null
          id: string | null
          staff_id: string | null
          start_time: string | null
          status: string | null
        }
        Insert: {
          appointment_type?: string | null
          created_at?: string | null
          end_time?: string | null
          id?: string | null
          staff_id?: string | null
          start_time?: string | null
          status?: string | null
        }
        Update: {
          appointment_type?: string | null
          created_at?: string | null
          end_time?: string | null
          id?: string | null
          staff_id?: string | null
          start_time?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "slots_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      check_merchant_phone_match: {
        Args: { p_merchant_id: string }
        Returns: boolean
      }
      check_merchant_phone_match_v2: {
        Args: { p_merchant_id: string }
        Returns: boolean
      }
      normalize_e164: { Args: { us_phone: string }; Returns: string }
    }
    Enums: {
      calendar_event_status: "created" | "updated" | "deleted" | "error"
      slot_created_via: "dashboard" | "sms" | "api"
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
  public: {
    Enums: {
      calendar_event_status: ["created", "updated", "deleted", "error"],
      slot_created_via: ["dashboard", "sms", "api"],
    },
  },
} as const
