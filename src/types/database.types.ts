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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      activities: {
        Row: {
          activity: string
          actual_end: string | null
          actual_start: string | null
          applicable: boolean | null
          configuration: string | null
          created_at: string | null
          delay_days: number | null
          delay_reason: string | null
          expected_end: string | null
          expected_start: string | null
          flat_number: number
          flat_status: string | null
          floor: number
          floor_status: string | null
          id: string
          project_id: string
          remarks: string | null
          revised_end: string | null
          revised_start: string | null
          risk_status: string | null
          rooms: Json | null
          series: string | null
          sort_order: number | null
          stage: string
          stage_gate: string | null
          status: string | null
          sub_stage_status: string | null
          updated_at: string | null
          vendor: string | null
        }
        Insert: {
          activity: string
          actual_end?: string | null
          actual_start?: string | null
          applicable?: boolean | null
          configuration?: string | null
          created_at?: string | null
          delay_days?: number | null
          delay_reason?: string | null
          expected_end?: string | null
          expected_start?: string | null
          flat_number: number
          flat_status?: string | null
          floor: number
          floor_status?: string | null
          id?: string
          project_id: string
          remarks?: string | null
          revised_end?: string | null
          revised_start?: string | null
          risk_status?: string | null
          rooms?: Json | null
          series?: string | null
          sort_order?: number | null
          stage: string
          stage_gate?: string | null
          status?: string | null
          sub_stage_status?: string | null
          updated_at?: string | null
          vendor?: string | null
        }
        Update: {
          activity?: string
          actual_end?: string | null
          actual_start?: string | null
          applicable?: boolean | null
          configuration?: string | null
          created_at?: string | null
          delay_days?: number | null
          delay_reason?: string | null
          expected_end?: string | null
          expected_start?: string | null
          flat_number?: number
          flat_status?: string | null
          floor?: number
          floor_status?: string | null
          id?: string
          project_id?: string
          remarks?: string | null
          revised_end?: string | null
          revised_start?: string | null
          risk_status?: string | null
          rooms?: Json | null
          series?: string | null
          sort_order?: number | null
          stage?: string
          stage_gate?: string | null
          status?: string | null
          sub_stage_status?: string | null
          updated_at?: string | null
          vendor?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activities_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      activity_photos: {
        Row: {
          activity_id: string
          activity_name: string | null
          created_at: string | null
          file_name: string
          file_size: number | null
          flat_number: number | null
          floor: number | null
          id: string
          project_id: string
          stage: string | null
          stage_gate: string | null
          storage_path: string
          uploaded_by: string | null
        }
        Insert: {
          activity_id: string
          activity_name?: string | null
          created_at?: string | null
          file_name: string
          file_size?: number | null
          flat_number?: number | null
          floor?: number | null
          id?: string
          project_id: string
          stage?: string | null
          stage_gate?: string | null
          storage_path: string
          uploaded_by?: string | null
        }
        Update: {
          activity_id?: string
          activity_name?: string | null
          created_at?: string | null
          file_name?: string
          file_size?: number | null
          flat_number?: number | null
          floor?: number | null
          id?: string
          project_id?: string
          stage?: string | null
          stage_gate?: string | null
          storage_path?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activity_photos_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_photos_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      app_errors: {
        Row: {
          action: string
          context: Json | null
          created_at: string | null
          friendly_message: string
          id: string
          page_url: string | null
          raw_error: string
          user_email: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          context?: Json | null
          created_at?: string | null
          friendly_message: string
          id?: string
          page_url?: string | null
          raw_error: string
          user_email?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          context?: Json | null
          created_at?: string | null
          friendly_message?: string
          id?: string
          page_url?: string | null
          raw_error?: string
          user_email?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      app_settings: {
        Row: {
          key: string
          updated_at: string | null
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string | null
          value: Json
        }
        Update: {
          key?: string
          updated_at?: string | null
          value?: Json
        }
        Relationships: []
      }
      audit_log: {
        Row: {
          activity_id: string | null
          activity_name: string | null
          changed_by: string | null
          created_at: string | null
          flat_number: number | null
          floor: number | null
          id: string
          new_status: string | null
          old_status: string | null
          project_id: string | null
          stage: string | null
          stage_gate: string | null
        }
        Insert: {
          activity_id?: string | null
          activity_name?: string | null
          changed_by?: string | null
          created_at?: string | null
          flat_number?: number | null
          floor?: number | null
          id?: string
          new_status?: string | null
          old_status?: string | null
          project_id?: string | null
          stage?: string | null
          stage_gate?: string | null
        }
        Update: {
          activity_id?: string | null
          activity_name?: string | null
          changed_by?: string | null
          created_at?: string | null
          flat_number?: number | null
          floor?: number | null
          id?: string
          new_status?: string | null
          old_status?: string | null
          project_id?: string | null
          stage?: string | null
          stage_gate?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_log_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string | null
          id: string
          is_read: boolean | null
          message: string
          metadata: Json | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          message: string
          metadata?: Json | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          message?: string
          metadata?: Json | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string | null
          email: string | null
          full_name: string
          id: string
          is_active: boolean | null
          phone: string | null
          role: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          full_name: string
          id: string
          is_active?: boolean | null
          phone?: string | null
          role?: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string | null
          full_name?: string
          id?: string
          is_active?: boolean | null
          phone?: string | null
          role?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      projects: {
        Row: {
          created_at: string | null
          created_by: string | null
          has_template: boolean | null
          id: string
          location: string
          name: string
          refuge_floors: number[] | null
          refuge_units: number[] | null
          status: string | null
          total_flats: number | null
          total_floors: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          has_template?: boolean | null
          id?: string
          location: string
          name: string
          refuge_floors?: number[] | null
          refuge_units?: number[] | null
          status?: string | null
          total_flats?: number | null
          total_floors?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          has_template?: boolean | null
          id?: string
          location?: string
          name?: string
          refuge_floors?: number[] | null
          refuge_units?: number[] | null
          status?: string | null
          total_flats?: number | null
          total_floors?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      reasons: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean | null
          label: string
          sort_order: number | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          label: string
          sort_order?: number | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          label?: string
          sort_order?: number | null
        }
        Relationships: []
      }
      supervisor_assignments: {
        Row: {
          allow_vendor_reassignment: boolean | null
          assigned_at: string | null
          assigned_floors: number[] | null
          id: string
          project_id: string | null
          supervisor_id: string | null
        }
        Insert: {
          allow_vendor_reassignment?: boolean | null
          assigned_at?: string | null
          assigned_floors?: number[] | null
          id?: string
          project_id?: string | null
          supervisor_id?: string | null
        }
        Update: {
          allow_vendor_reassignment?: boolean | null
          assigned_at?: string | null
          assigned_floors?: number[] | null
          id?: string
          project_id?: string | null
          supervisor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "supervisor_assignments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supervisor_assignments_supervisor_id_fkey"
            columns: ["supervisor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      unit_stores: {
        Row: {
          created_at: string
          flat_number: number
          floor: number
          id: string
          marked_at: string
          marked_by: string | null
          notes: string | null
          project_id: string
          unmarked_at: string | null
          unmarked_by: string | null
        }
        Insert: {
          created_at?: string
          flat_number: number
          floor: number
          id?: string
          marked_at?: string
          marked_by?: string | null
          notes?: string | null
          project_id: string
          unmarked_at?: string | null
          unmarked_by?: string | null
        }
        Update: {
          created_at?: string
          flat_number?: number
          floor?: number
          id?: string
          marked_at?: string
          marked_by?: string | null
          notes?: string | null
          project_id?: string
          unmarked_at?: string | null
          unmarked_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "unit_stores_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_milestones: {
        Row: {
          id: string
          project_id: string
          title: string
          stage: string
          stage_gate: string | null
          floor_from: number
          floor_to: number
          target_date: string
          created_by: string | null
          created_at: string
          updated_at: string
          notes: string | null
        }
        Insert: {
          id?: string
          project_id: string
          title: string
          stage: string
          stage_gate?: string | null
          floor_from: number
          floor_to: number
          target_date: string
          created_by?: string | null
          created_at?: string
          updated_at?: string
          notes?: string | null
        }
        Update: {
          id?: string
          project_id?: string
          title?: string
          stage?: string
          stage_gate?: string | null
          floor_from?: number
          floor_to?: number
          target_date?: string
          created_by?: string | null
          created_at?: string
          updated_at?: string
          notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_milestones_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      floor_handovers: {
        Row: {
          id: string
          project_id: string
          floor: number
          planned_handover: string | null
          actual_handover: string | null
          remarks: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          project_id: string
          floor: number
          planned_handover?: string | null
          actual_handover?: string | null
          remarks?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          floor?: number
          planned_handover?: string | null
          actual_handover?: string | null
          remarks?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "floor_handovers_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      uploads: {
        Row: {
          file_name: string
          id: string
          project_id: string
          total_rows: number | null
          uploaded_at: string | null
          uploaded_by: string | null
        }
        Insert: {
          file_name: string
          id?: string
          project_id: string
          total_rows?: number | null
          uploaded_at?: string | null
          uploaded_by?: string | null
        }
        Update: {
          file_name?: string
          id?: string
          project_id?: string
          total_rows?: number | null
          uploaded_at?: string | null
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "uploads_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      distinct_floors: {
        Args: { p_project_id: string }
        Returns: { floor: number }[]
      }
      distinct_stages: {
        Args: { p_project_id: string }
        Returns: { stage: string }[]
      }
      get_dashboard_data: { Args: { p_project_id: string }; Returns: Json }
      get_distinct_floors: {
        Args: { p_project_id: string }
        Returns: {
          floor: number
        }[]
      }
      is_admin: { Args: never; Returns: boolean }
      is_management: { Args: never; Returns: boolean }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const

type DbTables = Database['public']['Tables'];
export type ActivityRow = DbTables['activities']['Row'];
export type ActivityInsert = DbTables['activities']['Insert'];
export type ActivityUpdate = DbTables['activities']['Update'];
export type ProjectRow = DbTables['projects']['Row'];
export type ProjectInsert = DbTables['projects']['Insert'];
export type ProjectUpdate = DbTables['projects']['Update'];
export type ProfileRow = DbTables['profiles']['Row'];
export type AuditLogRow = DbTables['audit_log']['Row'];
export type ActivityPhotoRow = DbTables['activity_photos']['Row'];
export type AppErrorRow = DbTables['app_errors']['Row'];
export type ReasonRow = DbTables['reasons']['Row'];
export type SupervisorAssignmentRow = DbTables['supervisor_assignments']['Row'];
export type UploadRow = DbTables['uploads']['Row'];
export type NotificationRow = DbTables['notifications']['Row'];
export type NotificationInsert = DbTables['notifications']['Insert'];
export type UnitStoreRow = DbTables['unit_stores']['Row'];
export type UnitStoreInsert = DbTables['unit_stores']['Insert'];
export type UnitStoreUpdate = DbTables['unit_stores']['Update'];
