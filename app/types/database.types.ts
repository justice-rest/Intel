import { Attachment } from "@ai-sdk/ui-utils"

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      projects: {
        Row: {
          id: string
          name: string
          user_id: string
          created_at: string | null
        }
        Insert: {
          id?: string
          name: string
          user_id: string
          created_at?: string | null
        }
        Update: {
          id?: string
          name?: string
          user_id?: string
          created_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "projects_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_attachments: {
        Row: {
          chat_id: string
          created_at: string
          file_name: string | null
          file_size: number | null
          file_type: string | null
          file_url: string
          id: string
          user_id: string
        }
        Insert: {
          chat_id: string
          created_at?: string
          file_name?: string | null
          file_size?: number | null
          file_type?: string | null
          file_url: string
          id?: string
          user_id: string
        }
        Update: {
          chat_id?: string
          created_at?: string
          file_name?: string | null
          file_size?: number | null
          file_type?: string | null
          file_url?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_chat"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "chats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_user"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      chats: {
        Row: {
          created_at: string | null
          updated_at: string | null
          id: string
          model: string | null
          project_id: string | null
          title: string | null
          user_id: string
          public: boolean
          pinned: boolean
          pinned_at: string | null
          system_prompt: string | null
          knowledge_profile_id: string | null
          custom_system_prompt: string | null
        }
        Insert: {
          created_at?: string | null
          updated_at?: string | null
          id?: string
          model?: string | null
          project_id?: string | null
          title?: string | null
          user_id: string
          public?: boolean
          pinned?: boolean
          pinned_at?: string | null
          system_prompt?: string | null
          knowledge_profile_id?: string | null
          custom_system_prompt?: string | null
        }
        Update: {
          created_at?: string | null
          updated_at?: string | null
          id?: string
          model?: string | null
          project_id?: string | null
          title?: string | null
          user_id?: string
          public?: boolean
          pinned?: boolean
          pinned_at?: string | null
          system_prompt?: string | null
          knowledge_profile_id?: string | null
          custom_system_prompt?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chats_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chats_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          experimental_attachments: Attachment[]
          chat_id: string
          content: string | null
          created_at: string | null
          id: number
          role: "system" | "user" | "assistant" | "data"
          parts: Json | null
          user_id?: string | null
          message_group_id: string | null
          model: string | null
        }
        Insert: {
          experimental_attachments?: Attachment[]
          chat_id: string
          content: string | null
          created_at?: string | null
          id?: number
          role: "system" | "user" | "assistant" | "data"
          parts?: Json
          user_id?: string | null
          message_group_id?: string | null
          model?: string | null
        }
        Update: {
          experimental_attachments?: Attachment[]
          chat_id?: string
          content?: string | null
          created_at?: string | null
          id?: number
          role?: "system" | "user" | "assistant" | "data"
          parts?: Json
          user_id?: string | null
          message_group_id?: string | null
          model?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          anonymous: boolean | null
          created_at: string | null
          daily_message_count: number | null
          daily_reset: string | null
          display_name: string | null
          email: string
          favorite_models: string[] | null
          id: string
          message_count: number | null
          premium: boolean | null
          profile_image: string | null
          last_active_at: string | null
          daily_pro_message_count: number | null
          daily_pro_reset: string | null
          system_prompt: string | null
          first_name: string | null
          welcome_completed: boolean | null
          subscription_status: string | null
          subscription_tier: string | null
        }
        Insert: {
          anonymous?: boolean | null
          created_at?: string | null
          daily_message_count?: number | null
          daily_reset?: string | null
          display_name?: string | null
          email: string
          favorite_models?: string[] | null
          id: string
          message_count?: number | null
          premium?: boolean | null
          profile_image?: string | null
          last_active_at?: string | null
          daily_pro_message_count?: number | null
          daily_pro_reset?: string | null
          system_prompt?: string | null
          first_name?: string | null
          welcome_completed?: boolean | null
          subscription_status?: string | null
          subscription_tier?: string | null
        }
        Update: {
          anonymous?: boolean | null
          created_at?: string | null
          daily_message_count?: number | null
          daily_reset?: string | null
          display_name?: string | null
          email?: string
          favorite_models?: string[] | null
          id?: string
          message_count?: number | null
          premium?: boolean | null
          profile_image?: string | null
          last_active_at?: string | null
          daily_pro_message_count?: number | null
          daily_pro_reset?: string | null
          system_prompt?: string | null
          first_name?: string | null
          welcome_completed?: boolean | null
          subscription_status?: string | null
          subscription_tier?: string | null
        }
        Relationships: []
      }
      feedback: {
        Row: {
          created_at: string | null
          id: string
          message: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          message: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          message?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "feedback_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_keys: {
        Row: {
          user_id: string
          provider: string
          encrypted_key: string
          iv: string
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          user_id: string
          provider: string
          encrypted_key: string
          iv: string
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          user_id?: string
          provider?: string
          encrypted_key?: string
          iv?: string
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_keys_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_preferences: {
        Row: {
          user_id: string
          layout: string | null
          prompt_suggestions: boolean | null
          show_tool_invocations: boolean | null
          show_conversation_previews: boolean | null
          multi_model_enabled: boolean | null
          hidden_models: string[] | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          user_id: string
          layout?: string | null
          prompt_suggestions?: boolean | null
          show_tool_invocations?: boolean | null
          show_conversation_previews?: boolean | null
          multi_model_enabled?: boolean | null
          hidden_models?: string[] | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          user_id?: string
          layout?: string | null
          prompt_suggestions?: boolean | null
          show_tool_invocations?: boolean | null
          show_conversation_previews?: boolean | null
          multi_model_enabled?: boolean | null
          hidden_models?: string[] | null
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_preferences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      rag_documents: {
        Row: {
          id: string
          user_id: string
          file_name: string
          file_url: string
          file_size: number
          file_type: string
          page_count: number | null
          word_count: number | null
          language: string
          tags: string[]
          status: "uploading" | "processing" | "ready" | "failed"
          error_message: string | null
          created_at: string
          processed_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          file_name: string
          file_url: string
          file_size: number
          file_type?: string
          page_count?: number | null
          word_count?: number | null
          language?: string
          tags?: string[]
          status?: "uploading" | "processing" | "ready" | "failed"
          error_message?: string | null
          created_at?: string
          processed_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          file_name?: string
          file_url?: string
          file_size?: number
          file_type?: string
          page_count?: number | null
          word_count?: number | null
          language?: string
          tags?: string[]
          status?: "uploading" | "processing" | "ready" | "failed"
          error_message?: string | null
          created_at?: string
          processed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rag_documents_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      rag_document_chunks: {
        Row: {
          id: string
          document_id: string
          user_id: string
          chunk_index: number
          content: string
          page_number: number | null
          embedding: string // JSON-encoded vector
          token_count: number | null
          created_at: string
        }
        Insert: {
          id?: string
          document_id: string
          user_id: string
          chunk_index: number
          content: string
          page_number?: number | null
          embedding: string
          token_count?: number | null
          created_at?: string
        }
        Update: {
          id?: string
          document_id?: string
          user_id?: string
          chunk_index?: number
          content?: string
          page_number?: number | null
          embedding?: string
          token_count?: number | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rag_document_chunks_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "rag_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rag_document_chunks_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_memories: {
        Row: {
          id: string
          user_id: string
          content: string
          memory_type: "auto" | "explicit"
          importance_score: number
          metadata: Json
          embedding: string // JSON-encoded vector
          access_count: number
          last_accessed_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          content: string
          memory_type?: "auto" | "explicit"
          importance_score?: number
          metadata?: Json
          embedding: string
          access_count?: number
          last_accessed_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          content?: string
          memory_type?: "auto" | "explicit"
          importance_score?: number
          metadata?: Json
          embedding?: string
          access_count?: number
          last_accessed_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_memories_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      message_notes: {
        Row: {
          id: string
          message_id: number
          user_id: string
          content: string
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          message_id: number
          user_id: string
          content: string
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          message_id?: number
          user_id?: string
          content?: string
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "message_notes_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_notes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      // V2 Enterprise Memory Tables
      memories_v2: {
        Row: {
          id: string
          user_id: string
          content: string
          memory_tier: "hot" | "warm" | "cold"
          memory_kind: "episodic" | "semantic" | "procedural" | "profile"
          is_static: boolean
          version: number
          is_latest: boolean
          parent_memory_id: string | null
          root_memory_id: string | null
          is_forgotten: boolean
          forget_after: string | null
          forget_reason: string | null
          source_count: number
          is_inference: boolean
          source_chat_id: string | null
          source_message_id: number | null
          importance_score: number
          access_count: number
          access_velocity: number
          embedding: string | null
          embedding_model: string | null
          metadata: Json
          tags: string[]
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          content: string
          memory_tier?: "hot" | "warm" | "cold"
          memory_kind?: "episodic" | "semantic" | "procedural" | "profile"
          is_static?: boolean
          version?: number
          is_latest?: boolean
          parent_memory_id?: string | null
          root_memory_id?: string | null
          is_forgotten?: boolean
          forget_after?: string | null
          forget_reason?: string | null
          source_count?: number
          is_inference?: boolean
          source_chat_id?: string | null
          source_message_id?: number | null
          importance_score?: number
          access_count?: number
          access_velocity?: number
          embedding?: string | null
          embedding_model?: string | null
          metadata?: Json
          tags?: string[]
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          content?: string
          memory_tier?: "hot" | "warm" | "cold"
          memory_kind?: "episodic" | "semantic" | "procedural" | "profile"
          is_static?: boolean
          version?: number
          is_latest?: boolean
          parent_memory_id?: string | null
          root_memory_id?: string | null
          is_forgotten?: boolean
          forget_after?: string | null
          forget_reason?: string | null
          source_count?: number
          is_inference?: boolean
          source_chat_id?: string | null
          source_message_id?: number | null
          importance_score?: number
          access_count?: number
          access_velocity?: number
          embedding?: string | null
          embedding_model?: string | null
          metadata?: Json
          tags?: string[]
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "memories_v2_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memories_v2_source_chat_id_fkey"
            columns: ["source_chat_id"]
            isOneToOne: false
            referencedRelation: "chats"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_sync_logs: {
        Row: {
          id: string
          user_id: string
          provider: "bloomerang" | "virtuous" | "neoncrm"
          sync_type: "full" | "incremental"
          status: "pending" | "in_progress" | "completed" | "failed"
          records_synced: number
          records_failed: number
          started_at: string
          completed_at: string | null
          error_message: string | null
          metadata: Json
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          provider: "bloomerang" | "virtuous" | "neoncrm"
          sync_type: "full" | "incremental"
          status?: "pending" | "in_progress" | "completed" | "failed"
          records_synced?: number
          records_failed?: number
          started_at?: string
          completed_at?: string | null
          error_message?: string | null
          metadata?: Json
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          provider?: "bloomerang" | "virtuous" | "neoncrm"
          sync_type?: "full" | "incremental"
          status?: "pending" | "in_progress" | "completed" | "failed"
          records_synced?: number
          records_failed?: number
          started_at?: string
          completed_at?: string | null
          error_message?: string | null
          metadata?: Json
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_sync_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_constituents: {
        Row: {
          id: string
          user_id: string
          provider: "bloomerang" | "virtuous" | "neoncrm"
          external_id: string
          first_name: string | null
          last_name: string | null
          full_name: string | null
          email: string | null
          phone: string | null
          street_address: string | null
          city: string | null
          state: string | null
          zip_code: string | null
          country: string | null
          total_lifetime_giving: number | null
          largest_gift: number | null
          last_gift_amount: number | null
          last_gift_date: string | null
          first_gift_date: string | null
          gift_count: number
          custom_fields: Json
          raw_data: Json
          synced_at: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          provider: "bloomerang" | "virtuous" | "neoncrm"
          external_id: string
          first_name?: string | null
          last_name?: string | null
          full_name?: string | null
          email?: string | null
          phone?: string | null
          street_address?: string | null
          city?: string | null
          state?: string | null
          zip_code?: string | null
          country?: string | null
          total_lifetime_giving?: number | null
          largest_gift?: number | null
          last_gift_amount?: number | null
          last_gift_date?: string | null
          first_gift_date?: string | null
          gift_count?: number
          custom_fields?: Json
          raw_data?: Json
          synced_at?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          provider?: "bloomerang" | "virtuous" | "neoncrm"
          external_id?: string
          first_name?: string | null
          last_name?: string | null
          full_name?: string | null
          email?: string | null
          phone?: string | null
          street_address?: string | null
          city?: string | null
          state?: string | null
          zip_code?: string | null
          country?: string | null
          total_lifetime_giving?: number | null
          largest_gift?: number | null
          last_gift_amount?: number | null
          last_gift_date?: string | null
          first_gift_date?: string | null
          gift_count?: number
          custom_fields?: Json
          raw_data?: Json
          synced_at?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_constituents_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_donations: {
        Row: {
          id: string
          user_id: string
          provider: "bloomerang" | "virtuous" | "neoncrm"
          external_id: string
          constituent_external_id: string
          amount: number
          donation_date: string | null
          donation_type: string | null
          campaign_name: string | null
          fund_name: string | null
          payment_method: string | null
          status: string | null
          notes: string | null
          custom_fields: Json
          raw_data: Json
          synced_at: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          provider: "bloomerang" | "virtuous" | "neoncrm"
          external_id: string
          constituent_external_id: string
          amount: number
          donation_date?: string | null
          donation_type?: string | null
          campaign_name?: string | null
          fund_name?: string | null
          payment_method?: string | null
          status?: string | null
          notes?: string | null
          custom_fields?: Json
          raw_data?: Json
          synced_at?: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          provider?: "bloomerang" | "virtuous" | "neoncrm"
          external_id?: string
          constituent_external_id?: string
          amount?: number
          donation_date?: string | null
          donation_type?: string | null
          campaign_name?: string | null
          fund_name?: string | null
          payment_method?: string | null
          status?: string | null
          notes?: string | null
          custom_fields?: Json
          raw_data?: Json
          synced_at?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_donations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      pdf_branding: {
        Row: {
          id: string
          user_id: string
          primary_color: string
          accent_color: string
          logo_url: string | null
          logo_base64: string | null
          logo_content_type: string | null
          hide_default_footer: boolean
          custom_footer_text: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          primary_color?: string
          accent_color?: string
          logo_url?: string | null
          logo_base64?: string | null
          logo_content_type?: string | null
          hide_default_footer?: boolean
          custom_footer_text?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          primary_color?: string
          accent_color?: string
          logo_url?: string | null
          logo_base64?: string | null
          logo_content_type?: string | null
          hide_default_footer?: boolean
          custom_footer_text?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pdf_branding_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      search_rag_chunks: {
        Args: {
          query_embedding: string // JSON-encoded vector
          match_user_id: string
          match_count?: number
          similarity_threshold?: number
          filter_document_ids?: string[] | null
        }
        Returns: Array<{
          id: string
          document_id: string
          document_name: string
          content: string
          page_number: number | null
          chunk_index: number
          similarity: number
        }>
      }
      get_rag_storage_usage: {
        Args: {
          user_id_param: string
        }
        Returns: Array<{
          document_count: number
          total_bytes: number
          chunk_count: number
        }>
      }
      search_user_memories: {
        Args: {
          query_embedding: string // JSON-encoded vector
          match_user_id: string
          match_count?: number
          similarity_threshold?: number
          memory_type_filter?: string | null
          min_importance?: number
        }
        Returns: Array<{
          id: string
          content: string
          memory_type: string
          importance_score: number
          metadata: Json
          similarity: number
          weighted_score: number
          created_at: string
          last_accessed_at: string | null
        }>
      }
      get_user_memory_stats: {
        Args: {
          user_id_param: string
        }
        Returns: Array<{
          total_memories: number
          auto_memories: number
          explicit_memories: number
          avg_importance: number
          most_recent_memory: string | null
        }>
      }
      increment_memory_access: {
        Args: {
          memory_id: string
        }
        Returns: void
      }
    }
    Enums: Record<string, never>
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type PublicSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  PublicTableNameOrOptions extends
    | keyof (PublicSchema["Tables"] & PublicSchema["Views"])
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
        Database[PublicTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
      Database[PublicTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : PublicTableNameOrOptions extends keyof (PublicSchema["Tables"] &
        PublicSchema["Views"])
    ? (PublicSchema["Tables"] &
        PublicSchema["Views"])[PublicTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  PublicEnumNameOrOptions extends
    | keyof PublicSchema["Enums"]
    | { schema: keyof Database },
  EnumName extends PublicEnumNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = PublicEnumNameOrOptions extends { schema: keyof Database }
  ? Database[PublicEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : PublicEnumNameOrOptions extends keyof PublicSchema["Enums"]
    ? PublicSchema["Enums"][PublicEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof PublicSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof PublicSchema["CompositeTypes"]
    ? PublicSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never
