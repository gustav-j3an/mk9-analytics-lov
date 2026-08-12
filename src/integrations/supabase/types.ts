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
          promoter_id: string | null
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
          promoter_id?: string | null
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
          promoter_id?: string | null
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
            foreignKeyName: "mk9_actual_visits_promoter_id_fkey"
            columns: ["promoter_id"]
            isOneToOne: false
            referencedRelation: "mk9_promoters"
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
      mk9_audit_logs: {
        Row: {
          action: string
          created_at: string
          entity: string | null
          entity_id: string | null
          id: string
          metadata: Json
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          entity?: string | null
          entity_id?: string | null
          id?: string
          metadata?: Json
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          entity?: string | null
          entity_id?: string | null
          id?: string
          metadata?: Json
          user_id?: string | null
        }
        Relationships: []
      }
      mk9_bulk_export_items: {
        Row: {
          contracted_visits_sum: number
          created_at: string
          error_details: string | null
          export_id: string
          id: string
          industry_id: string
          period_end: string | null
          period_start: string | null
          status: string
          unattended_stores_count: number
        }
        Insert: {
          contracted_visits_sum?: number
          created_at?: string
          error_details?: string | null
          export_id: string
          id?: string
          industry_id: string
          period_end?: string | null
          period_start?: string | null
          status?: string
          unattended_stores_count?: number
        }
        Update: {
          contracted_visits_sum?: number
          created_at?: string
          error_details?: string | null
          export_id?: string
          id?: string
          industry_id?: string
          period_end?: string | null
          period_start?: string | null
          status?: string
          unattended_stores_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "mk9_bulk_export_items_export_id_fkey"
            columns: ["export_id"]
            isOneToOne: false
            referencedRelation: "mk9_bulk_exports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mk9_bulk_export_items_industry_id_fkey"
            columns: ["industry_id"]
            isOneToOne: false
            referencedRelation: "mk9_industries"
            referencedColumns: ["id"]
          },
        ]
      }
      mk9_bulk_exports: {
        Row: {
          competence_month: number
          competence_year: number
          created_at: string
          download_url: string | null
          error_message: string | null
          filters: Json | null
          format: string
          id: string
          industries_with_pending_count: number
          progress_current: number
          progress_total: number
          selected_industries_count: number
          status: string
          total_contracted_visits: number
          total_unattended_stores: number
          updated_at: string
          user_id: string | null
        }
        Insert: {
          competence_month: number
          competence_year: number
          created_at?: string
          download_url?: string | null
          error_message?: string | null
          filters?: Json | null
          format: string
          id?: string
          industries_with_pending_count?: number
          progress_current?: number
          progress_total?: number
          selected_industries_count?: number
          status?: string
          total_contracted_visits?: number
          total_unattended_stores?: number
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          competence_month?: number
          competence_year?: number
          created_at?: string
          download_url?: string | null
          error_message?: string | null
          filters?: Json | null
          format?: string
          id?: string
          industries_with_pending_count?: number
          progress_current?: number
          progress_total?: number
          selected_industries_count?: number
          status?: string
          total_contracted_visits?: number
          total_unattended_stores?: number
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      mk9_checklist_import_batches: {
        Row: {
          created_at: string
          created_by: string
          failed_files: number
          finished_at: string | null
          id: string
          imported_files: number
          metadata: Json | null
          ready_files: number
          review_files: number
          started_at: string | null
          status: string
          total_files: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          failed_files?: number
          finished_at?: string | null
          id?: string
          imported_files?: number
          metadata?: Json | null
          ready_files?: number
          review_files?: number
          started_at?: string | null
          status?: string
          total_files?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          failed_files?: number
          finished_at?: string | null
          id?: string
          imported_files?: number
          metadata?: Json | null
          ready_files?: number
          review_files?: number
          started_at?: string | null
          status?: string
          total_files?: number
          updated_at?: string
        }
        Relationships: []
      }
      mk9_checklist_import_store_snapshots: {
        Row: {
          created_at: string
          id: string
          import_id: string
          industry_id: string
          monthly_frequency: number | null
          source_store_name: string
          store_id: string
          uf: string | null
          weekly_frequency: number | null
        }
        Insert: {
          created_at?: string
          id?: string
          import_id: string
          industry_id: string
          monthly_frequency?: number | null
          source_store_name: string
          store_id: string
          uf?: string | null
          weekly_frequency?: number | null
        }
        Update: {
          created_at?: string
          id?: string
          import_id?: string
          industry_id?: string
          monthly_frequency?: number | null
          source_store_name?: string
          store_id?: string
          uf?: string | null
          weekly_frequency?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "mk9_checklist_import_store_snapshots_import_id_fkey"
            columns: ["import_id"]
            isOneToOne: false
            referencedRelation: "mk9_checklist_imports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mk9_checklist_import_store_snapshots_industry_id_fkey"
            columns: ["industry_id"]
            isOneToOne: false
            referencedRelation: "mk9_industries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mk9_checklist_import_store_snapshots_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "mk9_stores"
            referencedColumns: ["id"]
          },
        ]
      }
      mk9_checklist_imports: {
        Row: {
          batch_id: string | null
          corrected_from_import_id: string | null
          corrected_to_import_id: string | null
          counters: Json
          created_at: string
          duration_ms: number | null
          error_message: string | null
          file_hash: string | null
          filename: string
          finished_at: string | null
          id: string
          import_mode: string | null
          industry_id: string
          is_operational_current: boolean | null
          operation_month: number
          operation_year: number
          preview: Json | null
          reason: string | null
          replacement_reason: string | null
          replaces_import_id: string | null
          revert_reason: string | null
          reverted_at: string | null
          reverted_by: string | null
          reverted_counters: Json | null
          started_at: string
          status: Database["public"]["Enums"]["mk9_import_status"]
          superseded_at: string | null
          superseded_by: string | null
          updated_at: string
          user_id: string | null
          validated_at: string | null
          validation_details: Json | null
          validation_status: string | null
        }
        Insert: {
          batch_id?: string | null
          corrected_from_import_id?: string | null
          corrected_to_import_id?: string | null
          counters?: Json
          created_at?: string
          duration_ms?: number | null
          error_message?: string | null
          file_hash?: string | null
          filename: string
          finished_at?: string | null
          id?: string
          import_mode?: string | null
          industry_id: string
          is_operational_current?: boolean | null
          operation_month: number
          operation_year: number
          preview?: Json | null
          reason?: string | null
          replacement_reason?: string | null
          replaces_import_id?: string | null
          revert_reason?: string | null
          reverted_at?: string | null
          reverted_by?: string | null
          reverted_counters?: Json | null
          started_at?: string
          status?: Database["public"]["Enums"]["mk9_import_status"]
          superseded_at?: string | null
          superseded_by?: string | null
          updated_at?: string
          user_id?: string | null
          validated_at?: string | null
          validation_details?: Json | null
          validation_status?: string | null
        }
        Update: {
          batch_id?: string | null
          corrected_from_import_id?: string | null
          corrected_to_import_id?: string | null
          counters?: Json
          created_at?: string
          duration_ms?: number | null
          error_message?: string | null
          file_hash?: string | null
          filename?: string
          finished_at?: string | null
          id?: string
          import_mode?: string | null
          industry_id?: string
          is_operational_current?: boolean | null
          operation_month?: number
          operation_year?: number
          preview?: Json | null
          reason?: string | null
          replacement_reason?: string | null
          replaces_import_id?: string | null
          revert_reason?: string | null
          reverted_at?: string | null
          reverted_by?: string | null
          reverted_counters?: Json | null
          started_at?: string
          status?: Database["public"]["Enums"]["mk9_import_status"]
          superseded_at?: string | null
          superseded_by?: string | null
          updated_at?: string
          user_id?: string | null
          validated_at?: string | null
          validation_details?: Json | null
          validation_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mk9_checklist_imports_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "mk9_checklist_import_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mk9_checklist_imports_corrected_from_import_id_fkey"
            columns: ["corrected_from_import_id"]
            isOneToOne: false
            referencedRelation: "mk9_checklist_imports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mk9_checklist_imports_corrected_to_import_id_fkey"
            columns: ["corrected_to_import_id"]
            isOneToOne: false
            referencedRelation: "mk9_checklist_imports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mk9_checklist_imports_industry_id_fkey"
            columns: ["industry_id"]
            isOneToOne: false
            referencedRelation: "mk9_industries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mk9_checklist_imports_replaces_import_id_fkey"
            columns: ["replaces_import_id"]
            isOneToOne: false
            referencedRelation: "mk9_checklist_imports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mk9_checklist_imports_superseded_by_fkey"
            columns: ["superseded_by"]
            isOneToOne: false
            referencedRelation: "mk9_checklist_imports"
            referencedColumns: ["id"]
          },
        ]
      }
      mk9_data_quality_issue_comments: {
        Row: {
          archived_at: string | null
          author_id: string | null
          body: string
          created_at: string
          id: string
          issue_id: string
          updated_at: string
          visibility: string
        }
        Insert: {
          archived_at?: string | null
          author_id?: string | null
          body: string
          created_at?: string
          id?: string
          issue_id: string
          updated_at?: string
          visibility?: string
        }
        Update: {
          archived_at?: string | null
          author_id?: string | null
          body?: string
          created_at?: string
          id?: string
          issue_id?: string
          updated_at?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "mk9_data_quality_issue_comments_issue_id_fkey"
            columns: ["issue_id"]
            isOneToOne: false
            referencedRelation: "mk9_data_quality_issues"
            referencedColumns: ["id"]
          },
        ]
      }
      mk9_data_quality_issue_events: {
        Row: {
          actor_id: string | null
          created_at: string
          event_type: string
          from_status: string | null
          id: string
          issue_id: string
          metadata: Json
          reason: string | null
          to_status: string | null
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          event_type: string
          from_status?: string | null
          id?: string
          issue_id: string
          metadata?: Json
          reason?: string | null
          to_status?: string | null
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          event_type?: string
          from_status?: string | null
          id?: string
          issue_id?: string
          metadata?: Json
          reason?: string | null
          to_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mk9_data_quality_issue_events_issue_id_fkey"
            columns: ["issue_id"]
            isOneToOne: false
            referencedRelation: "mk9_data_quality_issues"
            referencedColumns: ["id"]
          },
        ]
      }
      mk9_data_quality_issues: {
        Row: {
          acknowledged_at: string | null
          acknowledged_by: string | null
          archived_at: string | null
          assigned_at: string | null
          assigned_by: string | null
          assigned_to_user_id: string | null
          assignment_note: string | null
          category: string
          competence_month: number | null
          competence_year: number | null
          context_hash: string
          created_at: string
          description: string
          due_at: string | null
          entity_id: string | null
          entity_type: string
          evidence: Json
          fingerprint: string
          first_detected_at: string
          id: string
          ignore_reason: string | null
          ignore_until: string | null
          ignored_at: string | null
          ignored_by: string | null
          import_id: string | null
          industry_id: string | null
          issue_type: string
          last_comment_at: string | null
          last_seen_at: string
          peer_entity_id: string | null
          priority: string
          promoter_id: string | null
          reopened_at: string | null
          resolution_forced: boolean
          resolution_note: string | null
          resolution_type: string | null
          resolved_at: string | null
          resolved_by: string | null
          severity: string
          source: string
          started_at: string | null
          status: string
          store_id: string | null
          suggested_action: string | null
          supervisor_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          archived_at?: string | null
          assigned_at?: string | null
          assigned_by?: string | null
          assigned_to_user_id?: string | null
          assignment_note?: string | null
          category: string
          competence_month?: number | null
          competence_year?: number | null
          context_hash: string
          created_at?: string
          description: string
          due_at?: string | null
          entity_id?: string | null
          entity_type: string
          evidence?: Json
          fingerprint: string
          first_detected_at?: string
          id?: string
          ignore_reason?: string | null
          ignore_until?: string | null
          ignored_at?: string | null
          ignored_by?: string | null
          import_id?: string | null
          industry_id?: string | null
          issue_type: string
          last_comment_at?: string | null
          last_seen_at?: string
          peer_entity_id?: string | null
          priority?: string
          promoter_id?: string | null
          reopened_at?: string | null
          resolution_forced?: boolean
          resolution_note?: string | null
          resolution_type?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity: string
          source: string
          started_at?: string | null
          status?: string
          store_id?: string | null
          suggested_action?: string | null
          supervisor_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          archived_at?: string | null
          assigned_at?: string | null
          assigned_by?: string | null
          assigned_to_user_id?: string | null
          assignment_note?: string | null
          category?: string
          competence_month?: number | null
          competence_year?: number | null
          context_hash?: string
          created_at?: string
          description?: string
          due_at?: string | null
          entity_id?: string | null
          entity_type?: string
          evidence?: Json
          fingerprint?: string
          first_detected_at?: string
          id?: string
          ignore_reason?: string | null
          ignore_until?: string | null
          ignored_at?: string | null
          ignored_by?: string | null
          import_id?: string | null
          industry_id?: string | null
          issue_type?: string
          last_comment_at?: string | null
          last_seen_at?: string
          peer_entity_id?: string | null
          priority?: string
          promoter_id?: string | null
          reopened_at?: string | null
          resolution_forced?: boolean
          resolution_note?: string | null
          resolution_type?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
          source?: string
          started_at?: string | null
          status?: string
          store_id?: string | null
          suggested_action?: string | null
          supervisor_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mk9_data_quality_issues_industry_id_fkey"
            columns: ["industry_id"]
            isOneToOne: false
            referencedRelation: "mk9_industries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mk9_data_quality_issues_promoter_id_fkey"
            columns: ["promoter_id"]
            isOneToOne: false
            referencedRelation: "mk9_promoters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mk9_data_quality_issues_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "mk9_stores"
            referencedColumns: ["id"]
          },
        ]
      }
      mk9_freelancer_dailies: {
        Row: {
          amount: number
          created_at: string
          date: string
          freelancer_id: string
          id: string
          notes: string | null
          payment_date: string | null
          payment_status: Database["public"]["Enums"]["mk9_finance_status"]
          status: Database["public"]["Enums"]["mk9_freelancer_daily_status"]
          supervisor_id: string | null
          updated_at: string
        }
        Insert: {
          amount?: number
          created_at?: string
          date: string
          freelancer_id: string
          id?: string
          notes?: string | null
          payment_date?: string | null
          payment_status?: Database["public"]["Enums"]["mk9_finance_status"]
          status?: Database["public"]["Enums"]["mk9_freelancer_daily_status"]
          supervisor_id?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          date?: string
          freelancer_id?: string
          id?: string
          notes?: string | null
          payment_date?: string | null
          payment_status?: Database["public"]["Enums"]["mk9_finance_status"]
          status?: Database["public"]["Enums"]["mk9_freelancer_daily_status"]
          supervisor_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mk9_freelancer_dailies_freelancer_id_fkey"
            columns: ["freelancer_id"]
            isOneToOne: false
            referencedRelation: "mk9_freelancers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mk9_freelancer_dailies_supervisor_id_fkey"
            columns: ["supervisor_id"]
            isOneToOne: false
            referencedRelation: "mk9_supervisors"
            referencedColumns: ["id"]
          },
        ]
      }
      mk9_freelancer_daily_items: {
        Row: {
          created_at: string
          daily_id: string
          id: string
          industry_id: string
          store_id: string
        }
        Insert: {
          created_at?: string
          daily_id: string
          id?: string
          industry_id: string
          store_id: string
        }
        Update: {
          created_at?: string
          daily_id?: string
          id?: string
          industry_id?: string
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mk9_freelancer_daily_items_daily_id_fkey"
            columns: ["daily_id"]
            isOneToOne: false
            referencedRelation: "mk9_freelancer_dailies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mk9_freelancer_daily_items_industry_id_fkey"
            columns: ["industry_id"]
            isOneToOne: false
            referencedRelation: "mk9_industries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mk9_freelancer_daily_items_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "mk9_stores"
            referencedColumns: ["id"]
          },
        ]
      }
      mk9_freelancers: {
        Row: {
          active: boolean
          city: string | null
          cpf: string | null
          created_at: string
          default_daily_rate: number | null
          id: string
          name: string
          notes: string | null
          phone: string | null
          uf: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          city?: string | null
          cpf?: string | null
          created_at?: string
          default_daily_rate?: number | null
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          uf?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          city?: string | null
          cpf?: string | null
          created_at?: string
          default_daily_rate?: number | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          uf?: string | null
          updated_at?: string
        }
        Relationships: []
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
          archive_reason: string | null
          archived_at: string | null
          archived_by: string | null
          checklist_enabled_at: string | null
          checklist_enabled_by: string | null
          control_mode:
            | Database["public"]["Enums"]["mk9_industry_control_mode"]
            | null
          created_at: string
          created_by: string | null
          display_name: string | null
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
          notes: string | null
          requires_checklist: boolean
          source_type: string
          updated_at: string
          updated_by: string | null
          weeks_count: number | null
        }
        Insert: {
          archive_reason?: string | null
          archived_at?: string | null
          archived_by?: string | null
          checklist_enabled_at?: string | null
          checklist_enabled_by?: string | null
          control_mode?:
            | Database["public"]["Enums"]["mk9_industry_control_mode"]
            | null
          created_at?: string
          created_by?: string | null
          display_name?: string | null
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
          notes?: string | null
          requires_checklist?: boolean
          source_type?: string
          updated_at?: string
          updated_by?: string | null
          weeks_count?: number | null
        }
        Update: {
          archive_reason?: string | null
          archived_at?: string | null
          archived_by?: string | null
          checklist_enabled_at?: string | null
          checklist_enabled_by?: string | null
          control_mode?:
            | Database["public"]["Enums"]["mk9_industry_control_mode"]
            | null
          created_at?: string
          created_by?: string | null
          display_name?: string | null
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
          notes?: string | null
          requires_checklist?: boolean
          source_type?: string
          updated_at?: string
          updated_by?: string | null
          weeks_count?: number | null
        }
        Relationships: []
      }
      mk9_industry_contract_totals: {
        Row: {
          archived_at: string | null
          competence_month: number
          competence_year: number
          contracted_total: number
          created_at: string
          created_by: string | null
          id: string
          industry_id: string
          notes: string | null
          period_end: string | null
          period_start: string | null
          source_import_id: string | null
          source_type: string
          updated_at: string
          updated_by: string | null
          valid_from: string
          valid_until: string | null
        }
        Insert: {
          archived_at?: string | null
          competence_month: number
          competence_year: number
          contracted_total: number
          created_at?: string
          created_by?: string | null
          id?: string
          industry_id: string
          notes?: string | null
          period_end?: string | null
          period_start?: string | null
          source_import_id?: string | null
          source_type?: string
          updated_at?: string
          updated_by?: string | null
          valid_from?: string
          valid_until?: string | null
        }
        Update: {
          archived_at?: string | null
          competence_month?: number
          competence_year?: number
          contracted_total?: number
          created_at?: string
          created_by?: string | null
          id?: string
          industry_id?: string
          notes?: string | null
          period_end?: string | null
          period_start?: string | null
          source_import_id?: string | null
          source_type?: string
          updated_at?: string
          updated_by?: string | null
          valid_from?: string
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mk9_industry_contract_totals_industry_id_fkey"
            columns: ["industry_id"]
            isOneToOne: false
            referencedRelation: "mk9_industries"
            referencedColumns: ["id"]
          },
        ]
      }
      mk9_industry_period_config: {
        Row: {
          active: boolean
          created_at: string
          end_day: number
          id: string
          industry_id: string
          notes: string | null
          period_type: Database["public"]["Enums"]["mk9_period_type"]
          start_day: number
          updated_at: string
          uses_previous_month: boolean
          week_grouping: Database["public"]["Enums"]["mk9_week_grouping"]
        }
        Insert: {
          active?: boolean
          created_at?: string
          end_day?: number
          id?: string
          industry_id: string
          notes?: string | null
          period_type?: Database["public"]["Enums"]["mk9_period_type"]
          start_day?: number
          updated_at?: string
          uses_previous_month?: boolean
          week_grouping?: Database["public"]["Enums"]["mk9_week_grouping"]
        }
        Update: {
          active?: boolean
          created_at?: string
          end_day?: number
          id?: string
          industry_id?: string
          notes?: string | null
          period_type?: Database["public"]["Enums"]["mk9_period_type"]
          start_day?: number
          updated_at?: string
          uses_previous_month?: boolean
          week_grouping?: Database["public"]["Enums"]["mk9_week_grouping"]
        }
        Relationships: [
          {
            foreignKeyName: "mk9_industry_period_config_industry_id_fkey"
            columns: ["industry_id"]
            isOneToOne: true
            referencedRelation: "mk9_industries"
            referencedColumns: ["id"]
          },
        ]
      }
      mk9_industry_store_frequency: {
        Row: {
          created_at: string
          id: string
          industry_id: string
          last_import_id: string | null
          monthly_frequency: number | null
          store_id: string
          updated_at: string
          weekly_frequency: number | null
        }
        Insert: {
          created_at?: string
          id?: string
          industry_id: string
          last_import_id?: string | null
          monthly_frequency?: number | null
          store_id: string
          updated_at?: string
          weekly_frequency?: number | null
        }
        Update: {
          created_at?: string
          id?: string
          industry_id?: string
          last_import_id?: string | null
          monthly_frequency?: number | null
          store_id?: string
          updated_at?: string
          weekly_frequency?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "mk9_industry_store_frequency_industry_id_fkey"
            columns: ["industry_id"]
            isOneToOne: false
            referencedRelation: "mk9_industries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mk9_industry_store_frequency_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "mk9_stores"
            referencedColumns: ["id"]
          },
        ]
      }
      mk9_industry_store_frequency_versions: {
        Row: {
          archived_at: string | null
          created_at: string
          created_by: string | null
          id: string
          industry_id: string
          monthly_frequency: number | null
          notes: string | null
          source_import_id: string | null
          source_type: string
          store_id: string
          updated_at: string
          updated_by: string | null
          valid_from: string
          valid_until: string | null
          weekly_frequency: number | null
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          industry_id: string
          monthly_frequency?: number | null
          notes?: string | null
          source_import_id?: string | null
          source_type: string
          store_id: string
          updated_at?: string
          updated_by?: string | null
          valid_from: string
          valid_until?: string | null
          weekly_frequency?: number | null
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          industry_id?: string
          monthly_frequency?: number | null
          notes?: string | null
          source_import_id?: string | null
          source_type?: string
          store_id?: string
          updated_at?: string
          updated_by?: string | null
          valid_from?: string
          valid_until?: string | null
          weekly_frequency?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "mk9_isfv_industry_fkey"
            columns: ["industry_id"]
            isOneToOne: false
            referencedRelation: "mk9_industries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mk9_isfv_source_import_fkey"
            columns: ["source_import_id"]
            isOneToOne: false
            referencedRelation: "mk9_checklist_imports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mk9_isfv_store_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "mk9_stores"
            referencedColumns: ["id"]
          },
        ]
      }
      mk9_planned_routes: {
        Row: {
          archived_at: string | null
          created_at: string
          created_by: string | null
          id: string
          industry_id: string
          is_active: boolean
          last_import_id: string | null
          last_manual_edit_at: string | null
          operation_month: number
          operation_year: number
          promoter_id: string
          source_import_id: string | null
          source_sheet: string | null
          source_type: string
          store_id: string
          updated_at: string
          updated_by: string | null
          valid_from: string
          valid_until: string | null
          weekday: number
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          industry_id: string
          is_active?: boolean
          last_import_id?: string | null
          last_manual_edit_at?: string | null
          operation_month: number
          operation_year: number
          promoter_id: string
          source_import_id?: string | null
          source_sheet?: string | null
          source_type?: string
          store_id: string
          updated_at?: string
          updated_by?: string | null
          valid_from: string
          valid_until?: string | null
          weekday: number
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          industry_id?: string
          is_active?: boolean
          last_import_id?: string | null
          last_manual_edit_at?: string | null
          operation_month?: number
          operation_year?: number
          promoter_id?: string
          source_import_id?: string | null
          source_sheet?: string | null
          source_type?: string
          store_id?: string
          updated_at?: string
          updated_by?: string | null
          valid_from?: string
          valid_until?: string | null
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
          archived_at: string | null
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
          archived_at?: string | null
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
          archived_at?: string | null
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
      mk9_presence_teams: {
        Row: {
          active: boolean
          created_at: string
          id: string
          name: string
          supervisor_id: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          name: string
          supervisor_id?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          name?: string
          supervisor_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mk9_presence_teams_supervisor_id_fkey"
            columns: ["supervisor_id"]
            isOneToOne: false
            referencedRelation: "mk9_supervisors"
            referencedColumns: ["id"]
          },
        ]
      }
      mk9_profiles: {
        Row: {
          active: boolean
          avatar_url: string | null
          created_at: string
          email: string | null
          id: string
          last_login_at: string | null
          name: string | null
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          id?: string
          last_login_at?: string | null
          name?: string | null
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          id?: string
          last_login_at?: string | null
          name?: string | null
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      mk9_promoter_presence: {
        Row: {
          created_at: string | null
          created_by: string | null
          date: string
          id: string
          observation: string | null
          promoter_id: string
          status: Database["public"]["Enums"]["presence_status"]
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          date: string
          id?: string
          observation?: string | null
          promoter_id: string
          status: Database["public"]["Enums"]["presence_status"]
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          date?: string
          id?: string
          observation?: string | null
          promoter_id?: string
          status?: Database["public"]["Enums"]["presence_status"]
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mk9_promoter_presence_promoter_id_fkey"
            columns: ["promoter_id"]
            isOneToOne: false
            referencedRelation: "mk9_promoters"
            referencedColumns: ["id"]
          },
        ]
      }
      mk9_promoters: {
        Row: {
          archive_reason: string | null
          archived_at: string | null
          archived_by: string | null
          city: string | null
          contact: string | null
          contact_normalized: string | null
          created_at: string
          employee_number: string | null
          external_id: string | null
          id: string
          inactive_from: string | null
          is_active: boolean | null
          last_import_id: string | null
          mk9_supervisor_id: string | null
          name: string
          name_normalized: string
          notes: string | null
          presence_team_id: string | null
          supervisor_id: string | null
          uf: string | null
          updated_at: string
          updated_by: string | null
          user_id: string | null
        }
        Insert: {
          archive_reason?: string | null
          archived_at?: string | null
          archived_by?: string | null
          city?: string | null
          contact?: string | null
          contact_normalized?: string | null
          created_at?: string
          employee_number?: string | null
          external_id?: string | null
          id?: string
          inactive_from?: string | null
          is_active?: boolean | null
          last_import_id?: string | null
          mk9_supervisor_id?: string | null
          name: string
          name_normalized: string
          notes?: string | null
          presence_team_id?: string | null
          supervisor_id?: string | null
          uf?: string | null
          updated_at?: string
          updated_by?: string | null
          user_id?: string | null
        }
        Update: {
          archive_reason?: string | null
          archived_at?: string | null
          archived_by?: string | null
          city?: string | null
          contact?: string | null
          contact_normalized?: string | null
          created_at?: string
          employee_number?: string | null
          external_id?: string | null
          id?: string
          inactive_from?: string | null
          is_active?: boolean | null
          last_import_id?: string | null
          mk9_supervisor_id?: string | null
          name?: string
          name_normalized?: string
          notes?: string | null
          presence_team_id?: string | null
          supervisor_id?: string | null
          uf?: string | null
          updated_at?: string
          updated_by?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mk9_promoters_mk9_supervisor_id_fkey"
            columns: ["mk9_supervisor_id"]
            isOneToOne: false
            referencedRelation: "mk9_supervisors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mk9_promoters_presence_team_id_fkey"
            columns: ["presence_team_id"]
            isOneToOne: false
            referencedRelation: "mk9_presence_teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mk9_promoters_supervisor_id_fkey"
            columns: ["supervisor_id"]
            isOneToOne: false
            referencedRelation: "mk9_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      mk9_rls_policy_backup: {
        Row: {
          captured_at: string
          cmd: string | null
          id: string
          permissive: string | null
          policyname: string | null
          qual: string | null
          roles: unknown[] | null
          schemaname: string | null
          tablename: string | null
          with_check: string | null
        }
        Insert: {
          captured_at?: string
          cmd?: string | null
          id?: string
          permissive?: string | null
          policyname?: string | null
          qual?: string | null
          roles?: unknown[] | null
          schemaname?: string | null
          tablename?: string | null
          with_check?: string | null
        }
        Update: {
          captured_at?: string
          cmd?: string | null
          id?: string
          permissive?: string | null
          policyname?: string | null
          qual?: string | null
          roles?: unknown[] | null
          schemaname?: string | null
          tablename?: string | null
          with_check?: string | null
        }
        Relationships: []
      }
      mk9_stores: {
        Row: {
          archive_reason: string | null
          archived_at: string | null
          archived_by: string | null
          chain: string | null
          created_at: string
          created_by_checklist_import_id: string | null
          id: string
          is_incomplete: boolean
          last_import_id: string | null
          name: string
          name_normalized: string
          notes: string | null
          origin: string | null
          uf: string | null
          updated_at: string
        }
        Insert: {
          archive_reason?: string | null
          archived_at?: string | null
          archived_by?: string | null
          chain?: string | null
          created_at?: string
          created_by_checklist_import_id?: string | null
          id?: string
          is_incomplete?: boolean
          last_import_id?: string | null
          name: string
          name_normalized: string
          notes?: string | null
          origin?: string | null
          uf?: string | null
          updated_at?: string
        }
        Update: {
          archive_reason?: string | null
          archived_at?: string | null
          archived_by?: string | null
          chain?: string | null
          created_at?: string
          created_by_checklist_import_id?: string | null
          id?: string
          is_incomplete?: boolean
          last_import_id?: string | null
          name?: string
          name_normalized?: string
          notes?: string | null
          origin?: string | null
          uf?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mk9_stores_created_by_checklist_import_id_fkey"
            columns: ["created_by_checklist_import_id"]
            isOneToOne: false
            referencedRelation: "mk9_checklist_imports"
            referencedColumns: ["id"]
          },
        ]
      }
      mk9_supervisors: {
        Row: {
          active: boolean
          created_at: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      mk9_user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["mk9_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["mk9_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["mk9_role"]
          user_id?: string
        }
        Relationships: []
      }
      mk9_user_scopes: {
        Row: {
          created_at: string
          id: string
          scope_type: string
          scope_value: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          scope_type: string
          scope_value: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          scope_type?: string
          scope_value?: string
          user_id?: string
        }
        Relationships: []
      }
      mk9_visit_reconciliations: {
        Row: {
          actual_date: string | null
          actual_visit_id: string | null
          candidates: Json
          created_at: string
          date_diff_days: number | null
          id: string
          industry_id: string
          match_score: number
          match_type: Database["public"]["Enums"]["mk9_reconciliation_match_type"]
          notes: string | null
          operation_month: number
          operation_year: number
          planned_date: string | null
          planned_visit_id: string | null
          promoter_id: string | null
          raw_store_name: string | null
          raw_store_uf: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          reviewed_manually: boolean
          source_import_id: string | null
          status: Database["public"]["Enums"]["mk9_reconciliation_status"]
          store_id: string | null
          updated_at: string
        }
        Insert: {
          actual_date?: string | null
          actual_visit_id?: string | null
          candidates?: Json
          created_at?: string
          date_diff_days?: number | null
          id?: string
          industry_id: string
          match_score?: number
          match_type?: Database["public"]["Enums"]["mk9_reconciliation_match_type"]
          notes?: string | null
          operation_month: number
          operation_year: number
          planned_date?: string | null
          planned_visit_id?: string | null
          promoter_id?: string | null
          raw_store_name?: string | null
          raw_store_uf?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          reviewed_manually?: boolean
          source_import_id?: string | null
          status: Database["public"]["Enums"]["mk9_reconciliation_status"]
          store_id?: string | null
          updated_at?: string
        }
        Update: {
          actual_date?: string | null
          actual_visit_id?: string | null
          candidates?: Json
          created_at?: string
          date_diff_days?: number | null
          id?: string
          industry_id?: string
          match_score?: number
          match_type?: Database["public"]["Enums"]["mk9_reconciliation_match_type"]
          notes?: string | null
          operation_month?: number
          operation_year?: number
          planned_date?: string | null
          planned_visit_id?: string | null
          promoter_id?: string | null
          raw_store_name?: string | null
          raw_store_uf?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          reviewed_manually?: boolean
          source_import_id?: string | null
          status?: Database["public"]["Enums"]["mk9_reconciliation_status"]
          store_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mk9_visit_reconciliations_actual_visit_id_fkey"
            columns: ["actual_visit_id"]
            isOneToOne: false
            referencedRelation: "mk9_actual_visits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mk9_visit_reconciliations_industry_id_fkey"
            columns: ["industry_id"]
            isOneToOne: false
            referencedRelation: "mk9_industries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mk9_visit_reconciliations_planned_visit_id_fkey"
            columns: ["planned_visit_id"]
            isOneToOne: false
            referencedRelation: "mk9_planned_visits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mk9_visit_reconciliations_promoter_id_fkey"
            columns: ["promoter_id"]
            isOneToOne: false
            referencedRelation: "mk9_promoters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mk9_visit_reconciliations_source_import_id_fkey"
            columns: ["source_import_id"]
            isOneToOne: false
            referencedRelation: "mk9_checklist_imports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mk9_visit_reconciliations_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "mk9_stores"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      mk9_admin_archive_industry: {
        Args: {
          p_actor: string
          p_expected_updated_at: string
          p_industry_id: string
          p_reason: string
        }
        Returns: {
          archived_at: string
          id: string
          name: string
          updated_at: string
        }[]
      }
      mk9_admin_contract_total_set: {
        Args: {
          _actor?: string
          _expected_updated_at?: string
          _industry_id: string
          _month: number
          _notes?: string
          _period_end?: string
          _period_start?: string
          _total: number
          _year: number
        }
        Returns: Json
      }
      mk9_admin_create_checklist_industry: {
        Args: {
          p_actor?: string
          p_import_id?: string
          p_name: string
          p_name_normalized: string
          p_source?: string
        }
        Returns: {
          checklist_enabled_at: string
          id: string
          name: string
          requires_checklist: boolean
        }[]
      }
      mk9_admin_create_industry: {
        Args: {
          p_actor: string
          p_display_name: string
          p_end_day: number
          p_name: string
          p_name_normalized: string
          p_notes: string
          p_period_type: string
          p_requires_checklist: boolean
          p_start_day: number
          p_uses_previous_month: boolean
        }
        Returns: {
          id: string
          name: string
          requires_checklist: boolean
          updated_at: string
        }[]
      }
      mk9_admin_frequency_bulk_apply: {
        Args: {
          _actor?: string
          _allow_retroactive?: boolean
          _industry_id: string
          _items: Json
          _reason?: string
        }
        Returns: Json
      }
      mk9_admin_frequency_close: {
        Args: {
          _actor?: string
          _end_date: string
          _expected_updated_at?: string
          _reason?: string
          _version_id: string
        }
        Returns: Json
      }
      mk9_admin_frequency_set: {
        Args: {
          _actor?: string
          _allow_retroactive?: boolean
          _effective_date: string
          _expected_updated_at?: string
          _industry_id: string
          _monthly: number
          _reason?: string
          _store_id: string
          _weekly: number
        }
        Returns: Json
      }
      mk9_admin_reactivate_industry: {
        Args: {
          p_actor: string
          p_expected_updated_at: string
          p_industry_id: string
        }
        Returns: {
          archived_at: string
          id: string
          name: string
          updated_at: string
        }[]
      }
      mk9_admin_set_industry_requires_checklist:
        | {
            Args: {
              p_actor?: string
              p_industry_id: string
              p_reason?: string
              p_value: boolean
            }
            Returns: {
              id: string
              name: string
              requires_checklist: boolean
            }[]
          }
        | {
            Args: {
              p_actor?: string
              p_import_id?: string
              p_industry_id: string
              p_reason?: string
              p_source?: string
              p_value: boolean
            }
            Returns: {
              checklist_enabled_at: string
              id: string
              name: string
              requires_checklist: boolean
            }[]
          }
      mk9_admin_update_industry: {
        Args: {
          p_actor: string
          p_display_name: string
          p_expected_updated_at: string
          p_industry_id: string
          p_name: string
          p_name_normalized: string
          p_notes: string
          p_requires_checklist: boolean
        }
        Returns: {
          id: string
          name: string
          requires_checklist: boolean
          updated_at: string
        }[]
      }
      mk9_apply_frequency_diff: {
        Args: {
          _actor?: string
          _decisions: Json
          _force?: boolean
          _import_id: string
          _reason?: string
        }
        Returns: Json
      }
      mk9_apply_route_diff: {
        Args: { _decisions: Json; _force?: boolean; _import_id: string }
        Returns: Json
      }
      mk9_assert_privileged: { Args: never; Returns: undefined }
      mk9_merge_stores: {
        Args: { canonical: string; other: string }
        Returns: undefined
      }
      mk9_normalize_store_name: { Args: { input: string }; Returns: string }
      mk9_quality_add_comment: {
        Args: {
          _author_id: string
          _body: string
          _issue_id: string
          _visibility: string
        }
        Returns: {
          archived_at: string | null
          author_id: string | null
          body: string
          created_at: string
          id: string
          issue_id: string
          updated_at: string
          visibility: string
        }
        SetofOptions: {
          from: "*"
          to: "mk9_data_quality_issue_comments"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      mk9_quality_archive_comment: {
        Args: { _actor_id: string; _comment_id: string; _reason?: string }
        Returns: {
          archived_at: string | null
          author_id: string | null
          body: string
          created_at: string
          id: string
          issue_id: string
          updated_at: string
          visibility: string
        }
        SetofOptions: {
          from: "*"
          to: "mk9_data_quality_issue_comments"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      mk9_quality_assign_issue: {
        Args: {
          _actor_id: string
          _assignee: string
          _expected_updated_at?: string
          _issue_id: string
          _note?: string
        }
        Returns: {
          acknowledged_at: string | null
          acknowledged_by: string | null
          archived_at: string | null
          assigned_at: string | null
          assigned_by: string | null
          assigned_to_user_id: string | null
          assignment_note: string | null
          category: string
          competence_month: number | null
          competence_year: number | null
          context_hash: string
          created_at: string
          description: string
          due_at: string | null
          entity_id: string | null
          entity_type: string
          evidence: Json
          fingerprint: string
          first_detected_at: string
          id: string
          ignore_reason: string | null
          ignore_until: string | null
          ignored_at: string | null
          ignored_by: string | null
          import_id: string | null
          industry_id: string | null
          issue_type: string
          last_comment_at: string | null
          last_seen_at: string
          peer_entity_id: string | null
          priority: string
          promoter_id: string | null
          reopened_at: string | null
          resolution_forced: boolean
          resolution_note: string | null
          resolution_type: string | null
          resolved_at: string | null
          resolved_by: string | null
          severity: string
          source: string
          started_at: string | null
          status: string
          store_id: string | null
          suggested_action: string | null
          supervisor_id: string | null
          title: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "mk9_data_quality_issues"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      mk9_quality_check_version: {
        Args: { _cur: string; _expected: string }
        Returns: undefined
      }
      mk9_quality_default_due_at: {
        Args: { _from?: string; _severity: string }
        Returns: string
      }
      mk9_quality_edit_comment: {
        Args: { _actor_id: string; _body: string; _comment_id: string }
        Returns: {
          archived_at: string | null
          author_id: string | null
          body: string
          created_at: string
          id: string
          issue_id: string
          updated_at: string
          visibility: string
        }
        SetofOptions: {
          from: "*"
          to: "mk9_data_quality_issue_comments"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      mk9_quality_guard_status: { Args: never; Returns: Json }
      mk9_quality_legacy_counts: { Args: never; Returns: Json }
      mk9_quality_projection_divergence: {
        Args: never
        Returns: {
          industry_id: string
          kind: string
          projection_monthly: number
          projection_weekly: number
          store_id: string
          version_id: string
          version_monthly: number
          version_weekly: number
        }[]
      }
      mk9_quality_reopen_issue: {
        Args: {
          _actor_id: string
          _expected_updated_at?: string
          _issue_id: string
          _reason: string
        }
        Returns: {
          acknowledged_at: string | null
          acknowledged_by: string | null
          archived_at: string | null
          assigned_at: string | null
          assigned_by: string | null
          assigned_to_user_id: string | null
          assignment_note: string | null
          category: string
          competence_month: number | null
          competence_year: number | null
          context_hash: string
          created_at: string
          description: string
          due_at: string | null
          entity_id: string | null
          entity_type: string
          evidence: Json
          fingerprint: string
          first_detected_at: string
          id: string
          ignore_reason: string | null
          ignore_until: string | null
          ignored_at: string | null
          ignored_by: string | null
          import_id: string | null
          industry_id: string | null
          issue_type: string
          last_comment_at: string | null
          last_seen_at: string
          peer_entity_id: string | null
          priority: string
          promoter_id: string | null
          reopened_at: string | null
          resolution_forced: boolean
          resolution_note: string | null
          resolution_type: string | null
          resolved_at: string | null
          resolved_by: string | null
          severity: string
          source: string
          started_at: string | null
          status: string
          store_id: string | null
          suggested_action: string | null
          supervisor_id: string | null
          title: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "mk9_data_quality_issues"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      mk9_quality_set_planning: {
        Args: {
          _actor_id: string
          _clear_due: boolean
          _due_at: string
          _expected_updated_at?: string
          _issue_id: string
          _priority: string
          _reason?: string
        }
        Returns: {
          acknowledged_at: string | null
          acknowledged_by: string | null
          archived_at: string | null
          assigned_at: string | null
          assigned_by: string | null
          assigned_to_user_id: string | null
          assignment_note: string | null
          category: string
          competence_month: number | null
          competence_year: number | null
          context_hash: string
          created_at: string
          description: string
          due_at: string | null
          entity_id: string | null
          entity_type: string
          evidence: Json
          fingerprint: string
          first_detected_at: string
          id: string
          ignore_reason: string | null
          ignore_until: string | null
          ignored_at: string | null
          ignored_by: string | null
          import_id: string | null
          industry_id: string | null
          issue_type: string
          last_comment_at: string | null
          last_seen_at: string
          peer_entity_id: string | null
          priority: string
          promoter_id: string | null
          reopened_at: string | null
          resolution_forced: boolean
          resolution_note: string | null
          resolution_type: string | null
          resolved_at: string | null
          resolved_by: string | null
          severity: string
          source: string
          started_at: string | null
          status: string
          store_id: string | null
          suggested_action: string | null
          supervisor_id: string | null
          title: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "mk9_data_quality_issues"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      mk9_quality_sync_detections: {
        Args: {
          _competence_month?: number
          _competence_year?: number
          _detections: Json
          _issue_types: string[]
          _source: string
        }
        Returns: {
          auto_resolved: number
          created: number
          reopened: number
          seen: number
        }[]
      }
      mk9_quality_transition_issue: {
        Args: {
          _actor_id: string
          _issue_id: string
          _reason?: string
          _to_status: string
        }
        Returns: {
          acknowledged_at: string | null
          acknowledged_by: string | null
          archived_at: string | null
          assigned_at: string | null
          assigned_by: string | null
          assigned_to_user_id: string | null
          assignment_note: string | null
          category: string
          competence_month: number | null
          competence_year: number | null
          context_hash: string
          created_at: string
          description: string
          due_at: string | null
          entity_id: string | null
          entity_type: string
          evidence: Json
          fingerprint: string
          first_detected_at: string
          id: string
          ignore_reason: string | null
          ignore_until: string | null
          ignored_at: string | null
          ignored_by: string | null
          import_id: string | null
          industry_id: string | null
          issue_type: string
          last_comment_at: string | null
          last_seen_at: string
          peer_entity_id: string | null
          priority: string
          promoter_id: string | null
          reopened_at: string | null
          resolution_forced: boolean
          resolution_note: string | null
          resolution_type: string | null
          resolved_at: string | null
          resolved_by: string | null
          severity: string
          source: string
          started_at: string | null
          status: string
          store_id: string | null
          suggested_action: string | null
          supervisor_id: string | null
          title: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "mk9_data_quality_issues"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      mk9_quality_transition_issue_v2: {
        Args: {
          _actor_id: string
          _expected_updated_at?: string
          _forced?: boolean
          _ignore_until?: string
          _issue_id: string
          _reason?: string
          _resolution_type?: string
          _to_status: string
        }
        Returns: {
          acknowledged_at: string | null
          acknowledged_by: string | null
          archived_at: string | null
          assigned_at: string | null
          assigned_by: string | null
          assigned_to_user_id: string | null
          assignment_note: string | null
          category: string
          competence_month: number | null
          competence_year: number | null
          context_hash: string
          created_at: string
          description: string
          due_at: string | null
          entity_id: string | null
          entity_type: string
          evidence: Json
          fingerprint: string
          first_detected_at: string
          id: string
          ignore_reason: string | null
          ignore_until: string | null
          ignored_at: string | null
          ignored_by: string | null
          import_id: string | null
          industry_id: string | null
          issue_type: string
          last_comment_at: string | null
          last_seen_at: string
          peer_entity_id: string | null
          priority: string
          promoter_id: string | null
          reopened_at: string | null
          resolution_forced: boolean
          resolution_note: string | null
          resolution_type: string | null
          resolved_at: string | null
          resolved_by: string | null
          severity: string
          source: string
          started_at: string | null
          status: string
          store_id: string | null
          suggested_action: string | null
          supervisor_id: string | null
          title: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "mk9_data_quality_issues"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      mk9_resolve_frequency: {
        Args: {
          p_industry_id: string
          p_reference_date: string
          p_store_id: string
        }
        Returns: {
          match_count: number
          monthly_frequency: number
          source_import_id: string
          source_type: string
          status: string
          valid_from: string
          valid_until: string
          version_id: string
          weekly_frequency: number
        }[]
      }
      mk9_resolve_route_promoter: {
        Args: { _industry_id: string; _on_date: string; _store_id: string }
        Returns: {
          match_count: number
          promoter_id: string
          route_id: string
          valid_from: string
          valid_until: string
          weekday: number
        }[]
      }
      mk9_revert_checklist_import: {
        Args: { _actor?: string; _import_id: string; _reason: string }
        Returns: Json
      }
      mk9_set_frequency_manual: {
        Args: {
          _actor?: string
          _industry_id: string
          _monthly: number
          _reason?: string
          _store_id: string
          _valid_from?: string
          _weekly: number
        }
        Returns: string
      }
      mk9_set_industry_requires_checklist: {
        Args: { p_industry_id: string; p_reason?: string; p_value: boolean }
        Returns: {
          id: string
          name: string
          requires_checklist: boolean
        }[]
      }
      mk9_sync_planned_visits: {
        Args: { _archive_ids: string[]; _import_id: string; _rows: Json }
        Returns: Json
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
    }
    Enums: {
      mk9_actual_visit_origin: "CHECKLIST"
      mk9_finance_status: "A PAGAR" | "PAGO"
      mk9_freelancer_daily_status: "PLANEJADA" | "REALIZADA" | "CANCELADA"
      mk9_import_status:
        | "pending"
        | "previewing"
        | "confirmed"
        | "committing"
        | "done"
        | "failed"
        | "cancelled"
        | "INCONSISTENT"
        | "COMPLETED_WITH_ALERTS"
      mk9_industry_control_mode: "VISIT_CONTROLLED" | "FIXED_OPERATION"
      mk9_industry_status:
        | "DENTRO DA META"
        | "ACIMA DA META"
        | "ABAIXO DA META"
        | "SEM META"
        | "OK"
      mk9_period_type: "CALENDAR_MONTH" | "CUSTOM_CYCLE"
      mk9_reconciliation_match_type: "EXACT" | "NEAR_DATE" | "MANUAL" | "NONE"
      mk9_reconciliation_status:
        | "MATCHED"
        | "DATE_DIVERGENCE"
        | "UNPLANNED_VISIT"
        | "NOT_COMPLETED"
        | "STORE_NOT_FOUND"
        | "AMBIGUOUS"
        | "DUPLICATE_ACTUAL"
        | "MANUALLY_MATCHED"
        | "IGNORED"
      mk9_role: "ADMIN" | "SUPERVISOR" | "PROMOTOR" | "CLIENTE" | "AUDITOR"
      mk9_sync_mode: "full" | "add_only" | "registry_only" | "routes_only"
      mk9_visit_status: "planned" | "completed" | "cancelled" | "skipped"
      mk9_week_grouping: "CALENDAR_WEEK" | "CYCLE_WEEK"
      presence_status: "PRESENT" | "ABSENT" | "MEDICAL_CERTIFICATE" | "VACATION"
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
      mk9_finance_status: ["A PAGAR", "PAGO"],
      mk9_freelancer_daily_status: ["PLANEJADA", "REALIZADA", "CANCELADA"],
      mk9_import_status: [
        "pending",
        "previewing",
        "confirmed",
        "committing",
        "done",
        "failed",
        "cancelled",
        "INCONSISTENT",
        "COMPLETED_WITH_ALERTS",
      ],
      mk9_industry_control_mode: ["VISIT_CONTROLLED", "FIXED_OPERATION"],
      mk9_industry_status: [
        "DENTRO DA META",
        "ACIMA DA META",
        "ABAIXO DA META",
        "SEM META",
        "OK",
      ],
      mk9_period_type: ["CALENDAR_MONTH", "CUSTOM_CYCLE"],
      mk9_reconciliation_match_type: ["EXACT", "NEAR_DATE", "MANUAL", "NONE"],
      mk9_reconciliation_status: [
        "MATCHED",
        "DATE_DIVERGENCE",
        "UNPLANNED_VISIT",
        "NOT_COMPLETED",
        "STORE_NOT_FOUND",
        "AMBIGUOUS",
        "DUPLICATE_ACTUAL",
        "MANUALLY_MATCHED",
        "IGNORED",
      ],
      mk9_role: ["ADMIN", "SUPERVISOR", "PROMOTOR", "CLIENTE", "AUDITOR"],
      mk9_sync_mode: ["full", "add_only", "registry_only", "routes_only"],
      mk9_visit_status: ["planned", "completed", "cancelled", "skipped"],
      mk9_week_grouping: ["CALENDAR_WEEK", "CYCLE_WEEK"],
      presence_status: ["PRESENT", "ABSENT", "MEDICAL_CERTIFICATE", "VACATION"],
    },
  },
} as const
