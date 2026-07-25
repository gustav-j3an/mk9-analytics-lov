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
      mk9_actual_visits: {
        Row: {
          created_at: string
          id: string
          industry_id: string
          notes: string | null
          origin: Database["public"]["Enums"]["mk9_actual_visit_origin"]
          scheduled_date: string
          source_import_id: string | null
          status: string
          store_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          industry_id: string
          notes?: string | null
          origin?: Database["public"]["Enums"]["mk9_actual_visit_origin"]
          scheduled_date: string
          source_import_id?: string | null
          status?: string
          store_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          industry_id?: string
          notes?: string | null
          origin?: Database["public"]["Enums"]["mk9_actual_visit_origin"]
          scheduled_date?: string
          source_import_id?: string | null
          status?: string
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mk9_actual_visits_industry_id_fkey"
            columns: ["industry_id"]
            isOneToOne: false
            referencedRelation: "mk9_industries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mk9_actual_visits_source_import_id_fkey"
            columns: ["source_import_id"]
            isOneToOne: false
            referencedRelation: "mk9_checklist_imports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mk9_actual_visits_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "mk9_stores"
            referencedColumns: ["id"]
          },
        ]
      }
      mk9_checklist_imports: {
        Row: {
          counters: Json
          created_at: string
          duration_ms: number | null
          error_message: string | null
          file_hash: string | null
          filename: string
          finished_at: string | null
          id: string
          industry_id: string
          operation_month: number
          operation_year: number
          preview: Json | null
          started_at: string
          status: Database["public"]["Enums"]["mk9_import_status"]
          updated_at: string
          user_id: string | null
        }
        Insert: {
          counters?: Json
          created_at?: string
          duration_ms?: number | null
          error_message?: string | null
          file_hash?: string | null
          filename: string
          finished_at?: string | null
          id?: string
          industry_id: string
          operation_month: number
          operation_year: number
          preview?: Json | null
          started_at?: string
          status?: Database["public"]["Enums"]["mk9_import_status"]
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          counters?: Json
          created_at?: string
          duration_ms?: number | null
          error_message?: string | null
          file_hash?: string | null
          filename?: string
          finished_at?: string | null
          id?: string
          industry_id?: string
          operation_month?: number
          operation_year?: number
          preview?: Json | null
          started_at?: string
          status?: Database["public"]["Enums"]["mk9_import_status"]
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mk9_checklist_imports_industry_id_fkey"
            columns: ["industry_id"]
            isOneToOne: false
            referencedRelation: "mk9_industries"
            referencedColumns: ["id"]
          },
        ]
      }
      mk9_import_items: {
        Row: {
          action: string
          created_at: string
          entity_type: string
          excel_row: number | null
          id: string
          import_id: string
          payload: Json
          resolved_ids: Json
          sheet: string
          status: string
          warnings: Json
        }
        Insert: {
          action: string
          created_at?: string
          entity_type: string
          excel_row?: number | null
          id?: string
          import_id: string
          payload?: Json
          resolved_ids?: Json
          sheet: string
          status?: string
          warnings?: Json
        }
        Update: {
          action?: string
          created_at?: string
          entity_type?: string
          excel_row?: number | null
          id?: string
          import_id?: string
          payload?: Json
          resolved_ids?: Json
          sheet?: string
          status?: string
          warnings?: Json
        }
        Relationships: [
          {
            foreignKeyName: "mk9_import_items_import_id_fkey"
            columns: ["import_id"]
            isOneToOne: false
            referencedRelation: "mk9_imports"
            referencedColumns: ["id"]
          },
        ]
      }
      mk9_imports: {
        Row: {
          counters: Json
          created_at: string
          duration_ms: number | null
          error_message: string | null
          file_hash: string | null
          filename: string
          finished_at: string | null
          id: string
          operation_month: number
          operation_year: number
          preview: Json | null
          sheets_analyzed: Json
          started_at: string
          status: Database["public"]["Enums"]["mk9_import_status"]
          sync_mode: Database["public"]["Enums"]["mk9_sync_mode"]
          updated_at: string
          user_id: string | null
        }
        Insert: {
          counters?: Json
          created_at?: string
          duration_ms?: number | null
          error_message?: string | null
          file_hash?: string | null
          filename: string
          finished_at?: string | null
          id?: string
          operation_month: number
          operation_year: number
          preview?: Json | null
          sheets_analyzed?: Json
          started_at?: string
          status?: Database["public"]["Enums"]["mk9_import_status"]
          sync_mode?: Database["public"]["Enums"]["mk9_sync_mode"]
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          counters?: Json
          created_at?: string
          duration_ms?: number | null
          error_message?: string | null
          file_hash?: string | null
          filename?: string
          finished_at?: string | null
          id?: string
          operation_month?: number
          operation_year?: number
          preview?: Json | null
          sheets_analyzed?: Json
          started_at?: string
          status?: Database["public"]["Enums"]["mk9_import_status"]
          sync_mode?: Database["public"]["Enums"]["mk9_sync_mode"]
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      mk9_industries: {
        Row: {
          created_at: string
          frequency_difference: number | null
          frequency_status:
            | Database["public"]["Enums"]["mk9_industry_status"]
            | null
          id: string
          last_import_id: string | null
          monthly_contracted_frequency: number | null
          monthly_estimated_frequency: number | null
          name: string
          name_normalized: string
          updated_at: string
          weeks_count: number | null
        }
        Insert: {
          created_at?: string
          frequency_difference?: number | null
          frequency_status?:
            | Database["public"]["Enums"]["mk9_industry_status"]
            | null
          id?: string
          last_import_id?: string | null
          monthly_contracted_frequency?: number | null
          monthly_estimated_frequency?: number | null
          name: string
          name_normalized: string
          updated_at?: string
          weeks_count?: number | null
        }
        Update: {
          created_at?: string
          frequency_difference?: number | null
          frequency_status?:
            | Database["public"]["Enums"]["mk9_industry_status"]
            | null
          id?: string
          last_import_id?: string | null
          monthly_contracted_frequency?: number | null
          monthly_estimated_frequency?: number | null
          name?: string
          name_normalized?: string
          updated_at?: string
          weeks_count?: number | null
        }
        Relationships: []
      }
      mk9_planned_routes: {
        Row: {
          created_at: string
          id: string
          industry_id: string
          last_import_id: string | null
          operation_month: number
          operation_year: number
          promoter_id: string
          source_sheet: string | null
          store_id: string
          updated_at: string
          weekday: number
        }
        Insert: {
          created_at?: string
          id?: string
          industry_id: string
          last_import_id?: string | null
          operation_month: number
          operation_year: number
          promoter_id: string
          source_sheet?: string | null
          store_id: string
          updated_at?: string
          weekday: number
        }
        Update: {
          created_at?: string
          id?: string
          industry_id?: string
          last_import_id?: string | null
          operation_month?: number
          operation_year?: number
          promoter_id?: string
          source_sheet?: string | null
          store_id?: string
          updated_at?: string
          weekday?: number
        }
        Relationships: [
          {
            foreignKeyName: "mk9_planned_routes_industry_id_fkey"
            columns: ["industry_id"]
            isOneToOne: false
            referencedRelation: "mk9_industries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mk9_planned_routes_promoter_id_fkey"
            columns: ["promoter_id"]
            isOneToOne: false
            referencedRelation: "mk9_promoters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mk9_planned_routes_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "mk9_stores"
            referencedColumns: ["id"]
          },
        ]
      }
      mk9_planned_visits: {
        Row: {
          completed_at: string | null
          created_at: string
          id: string
          industry_id: string
          last_import_id: string | null
          notes: string | null
          promoter_id: string
          route_id: string | null
          scheduled_date: string
          source_sheet: string | null
          status: Database["public"]["Enums"]["mk9_visit_status"]
          store_id: string
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          id?: string
          industry_id: string
          last_import_id?: string | null
          notes?: string | null
          promoter_id: string
          route_id?: string | null
          scheduled_date: string
          source_sheet?: string | null
          status?: Database["public"]["Enums"]["mk9_visit_status"]
          store_id: string
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          id?: string
          industry_id?: string
          last_import_id?: string | null
          notes?: string | null
          promoter_id?: string
          route_id?: string | null
          scheduled_date?: string
          source_sheet?: string | null
          status?: Database["public"]["Enums"]["mk9_visit_status"]
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mk9_planned_visits_industry_id_fkey"
            columns: ["industry_id"]
            isOneToOne: false
            referencedRelation: "mk9_industries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mk9_planned_visits_promoter_id_fkey"
            columns: ["promoter_id"]
            isOneToOne: false
            referencedRelation: "mk9_promoters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mk9_planned_visits_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "mk9_planned_routes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mk9_planned_visits_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "mk9_stores"
            referencedColumns: ["id"]
          },
        ]
      }
      mk9_promoters: {
        Row: {
          city: string | null
          contact: string | null
          contact_normalized: string | null
          created_at: string
          external_id: string | null
          id: string
          last_import_id: string | null
          name: string
          name_normalized: string
          notes: string | null
          updated_at: string
        }
        Insert: {
          city?: string | null
          contact?: string | null
          contact_normalized?: string | null
          created_at?: string
          external_id?: string | null
          id?: string
          last_import_id?: string | null
          name: string
          name_normalized: string
          notes?: string | null
          updated_at?: string
        }
        Update: {
          city?: string | null
          contact?: string | null
          contact_normalized?: string | null
          created_at?: string
          external_id?: string | null
          id?: string
          last_import_id?: string | null
          name?: string
          name_normalized?: string
          notes?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      mk9_stores: {
        Row: {
          chain: string | null
          created_at: string
          id: string
          last_import_id: string | null
          name: string
          name_normalized: string
          uf: string | null
          updated_at: string
        }
        Insert: {
          chain?: string | null
          created_at?: string
          id?: string
          last_import_id?: string | null
          name: string
          name_normalized: string
          uf?: string | null
          updated_at?: string
        }
        Update: {
          chain?: string | null
          created_at?: string
          id?: string
          last_import_id?: string | null
          name?: string
          name_normalized?: string
          uf?: string | null
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      mk9_actual_visit_origin: "CHECKLIST"
      mk9_import_status:
        | "pending"
        | "previewing"
        | "confirmed"
        | "committing"
        | "done"
        | "failed"
        | "cancelled"
      mk9_industry_status:
        | "DENTRO DA META"
        | "ACIMA DA META"
        | "ABAIXO DA META"
        | "SEM META"
        | "OK"
      mk9_sync_mode: "full" | "add_only" | "registry_only" | "routes_only"
      mk9_visit_status: "planned" | "completed" | "cancelled" | "skipped"
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
      mk9_actual_visit_origin: ["CHECKLIST"],
      mk9_import_status: [
        "pending",
        "previewing",
        "confirmed",
        "committing",
        "done",
        "failed",
        "cancelled",
      ],
      mk9_industry_status: [
        "DENTRO DA META",
        "ACIMA DA META",
        "ABAIXO DA META",
        "SEM META",
        "OK",
      ],
      mk9_sync_mode: ["full", "add_only", "registry_only", "routes_only"],
      mk9_visit_status: ["planned", "completed", "cancelled", "skipped"],
    },
  },
} as const
