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
      consumers: {
        Row: {
          created_at: string | null
          id: string
          name: string
          phone: string
          saved_info: boolean | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          phone: string
          saved_info?: boolean | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          phone?: string
          saved_info?: boolean | null
          user_id?: string | null
        }
        Relationships: []
      }
      notification_idempotency: {
        Row: {
          consumer_id: string
          created_at: string | null
          id: string
          idempotency_key: string
          response_data: Json | null
          slot_id: string
        }
        Insert: {
          consumer_id: string
          created_at?: string | null
          id?: string
          idempotency_key: string
          response_data?: Json | null
          slot_id: string
        }
        Update: {
          consumer_id?: string
          created_at?: string | null
          id?: string
          idempotency_key?: string
          response_data?: Json | null
          slot_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_idempotency_consumer_id_fkey"
            columns: ["consumer_id"]
            isOneToOne: false
            referencedRelation: "consumers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_idempotency_slot_id_fkey"
            columns: ["slot_id"]
            isOneToOne: false
            referencedRelation: "slots"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          consumer_id: string
          id: string
          merchant_id: string
          sent_at: string | null
          slot_id: string
          status: string | null
        }
        Insert: {
          consumer_id: string
          id?: string
          merchant_id: string
          sent_at?: string | null
          slot_id: string
          status?: string | null
        }
        Update: {
          consumer_id?: string
          id?: string
          merchant_id?: string
          sent_at?: string | null
          slot_id?: string
          status?: string | null
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
            referencedRelation: "slots"
            referencedColumns: ["id"]
          },
        ]
      }
      notify_requests: {
        Row: {
          consumer_id: string
          created_at: string | null
          id: string
          merchant_id: string
          time_range: string
        }
        Insert: {
          consumer_id: string
          created_at?: string | null
          id?: string
          merchant_id: string
          time_range?: string
        }
        Update: {
          consumer_id?: string
          created_at?: string | null
          id?: string
          merchant_id?: string
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
        ]
      }
      otp_codes: {
        Row: {
          attempts: number | null
          code: string
          created_at: string | null
          expires_at: string
          id: string
          phone: string
          verified: boolean | null
        }
        Insert: {
          attempts?: number | null
          code: string
          created_at?: string | null
          expires_at: string
          id?: string
          phone: string
          verified?: boolean | null
        }
        Update: {
          attempts?: number | null
          code?: string
          created_at?: string | null
          expires_at?: string
          id?: string
          phone?: string
          verified?: boolean | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          address: string | null
          avg_appointment_value: number | null
          booking_url: string | null
          business_name: string
          created_at: string | null
          id: string
          phone: string
          require_confirmation: boolean | null
          updated_at: string | null
          use_booking_system: boolean | null
        }
        Insert: {
          address?: string | null
          avg_appointment_value?: number | null
          booking_url?: string | null
          business_name: string
          created_at?: string | null
          id: string
          phone: string
          require_confirmation?: boolean | null
          updated_at?: string | null
          use_booking_system?: boolean | null
        }
        Update: {
          address?: string | null
          avg_appointment_value?: number | null
          booking_url?: string | null
          business_name?: string
          created_at?: string | null
          id?: string
          phone?: string
          require_confirmation?: boolean | null
          updated_at?: string | null
          use_booking_system?: boolean | null
        }
        Relationships: []
      }
      slots: {
        Row: {
          appointment_name: string | null
          booked_by_consumer_id: string | null
          booked_by_name: string | null
          consumer_phone: string | null
          created_at: string | null
          duration_minutes: number
          end_time: string
          held_until: string | null
          id: string
          merchant_id: string
          start_time: string
          status: string
          updated_at: string | null
        }
        Insert: {
          appointment_name?: string | null
          booked_by_consumer_id?: string | null
          booked_by_name?: string | null
          consumer_phone?: string | null
          created_at?: string | null
          duration_minutes: number
          end_time: string
          held_until?: string | null
          id?: string
          merchant_id: string
          start_time: string
          status?: string
          updated_at?: string | null
        }
        Update: {
          appointment_name?: string | null
          booked_by_consumer_id?: string | null
          booked_by_name?: string | null
          consumer_phone?: string | null
          created_at?: string | null
          duration_minutes?: number
          end_time?: string
          held_until?: string | null
          id?: string
          merchant_id?: string
          start_time?: string
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "slots_booked_by_consumer_id_fkey"
            columns: ["booked_by_consumer_id"]
            isOneToOne: false
            referencedRelation: "consumers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "slots_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      sms_logs: {
        Row: {
          body: string
          direction: string
          error_code: string | null
          error_message: string | null
          from_number: string
          id: string
          message_sid: string
          sent_at: string | null
          status: string
          to_number: string
          updated_at: string | null
        }
        Insert: {
          body: string
          direction?: string
          error_code?: string | null
          error_message?: string | null
          from_number: string
          id?: string
          message_sid: string
          sent_at?: string | null
          status?: string
          to_number: string
          updated_at?: string | null
        }
        Update: {
          body?: string
          direction?: string
          error_code?: string | null
          error_message?: string | null
          from_number?: string
          id?: string
          message_sid?: string
          sent_at?: string | null
          status?: string
          to_number?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
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
      cleanup_expired_otps: { Args: never; Returns: undefined }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "merchant" | "consumer"
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
      app_role: ["admin", "merchant", "consumer"],
    },
  },
} as const
