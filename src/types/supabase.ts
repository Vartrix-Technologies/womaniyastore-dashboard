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
      attendance_logs: {
        Row: {
          clock_in: string
          clock_out: string | null
          created_at: string
          date: string
          delete_reason: string | null
          deleted_at: string | null
          deleted_by: string | null
          edit_reason: string | null
          edited_at: string | null
          edited_by: string | null
          id: string
          is_manual_entry: boolean | null
          manual_entry_reason: string | null
          shop_id: string
          staff_id: string
          status: Database["public"]["Enums"]["attendance_status"]
          total_break_minutes: number
        }
        Insert: {
          clock_in: string
          clock_out?: string | null
          created_at?: string
          date: string
          delete_reason?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          edit_reason?: string | null
          edited_at?: string | null
          edited_by?: string | null
          id?: string
          is_manual_entry?: boolean | null
          manual_entry_reason?: string | null
          shop_id: string
          staff_id: string
          status?: Database["public"]["Enums"]["attendance_status"]
          total_break_minutes?: number
        }
        Update: {
          clock_in?: string
          clock_out?: string | null
          created_at?: string
          date?: string
          delete_reason?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          edit_reason?: string | null
          edited_at?: string | null
          edited_by?: string | null
          id?: string
          is_manual_entry?: boolean | null
          manual_entry_reason?: string | null
          shop_id?: string
          staff_id?: string
          status?: Database["public"]["Enums"]["attendance_status"]
          total_break_minutes?: number
        }
        Relationships: [
          {
            foreignKeyName: "attendance_logs_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_logs_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "attendance_logs_edited_by_fkey"
            columns: ["edited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_logs_edited_by_fkey"
            columns: ["edited_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "attendance_logs_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_logs_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_logs_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      categories: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          shop_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          shop_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          shop_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_instances: {
        Row: {
          checklist_id: string
          completed_items: number | null
          created_at: string | null
          date: string
          id: string
          shop_id: string
          status: string | null
          total_items: number | null
          updated_at: string | null
        }
        Insert: {
          checklist_id: string
          completed_items?: number | null
          created_at?: string | null
          date: string
          id?: string
          shop_id: string
          status?: string | null
          total_items?: number | null
          updated_at?: string | null
        }
        Update: {
          checklist_id?: string
          completed_items?: number | null
          created_at?: string | null
          date?: string
          id?: string
          shop_id?: string
          status?: string | null
          total_items?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "checklist_instances_checklist_id_fkey"
            columns: ["checklist_id"]
            isOneToOne: false
            referencedRelation: "checklists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_instances_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_item_completions: {
        Row: {
          checklist_item_id: string
          completed_at: string | null
          completed_by: string
          id: string
          instance_id: string
          notes: string | null
        }
        Insert: {
          checklist_item_id: string
          completed_at?: string | null
          completed_by: string
          id?: string
          instance_id: string
          notes?: string | null
        }
        Update: {
          checklist_item_id?: string
          completed_at?: string | null
          completed_by?: string
          id?: string
          instance_id?: string
          notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "checklist_item_completions_checklist_item_id_fkey"
            columns: ["checklist_item_id"]
            isOneToOne: false
            referencedRelation: "checklist_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_item_completions_completed_by_fkey"
            columns: ["completed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_item_completions_completed_by_fkey"
            columns: ["completed_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "checklist_item_completions_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "checklist_instances"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_items: {
        Row: {
          checklist_id: string
          id: string
          label: string
          sort_order: number
        }
        Insert: {
          checklist_id: string
          id?: string
          label: string
          sort_order?: number
        }
        Update: {
          checklist_id?: string
          id?: string
          label?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "checklist_items_checklist_id_fkey"
            columns: ["checklist_id"]
            isOneToOne: false
            referencedRelation: "checklists"
            referencedColumns: ["id"]
          },
        ]
      }
      checklists: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean
          name: string
          recurrence_days: number[] | null
          recurrence_type: string | null
          shop_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          recurrence_days?: number[] | null
          recurrence_type?: string | null
          shop_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          recurrence_days?: number[] | null
          recurrence_type?: string | null
          shop_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "checklists_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklists_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "checklists_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      expense_categories: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          name: string
          shop_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name: string
          shop_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name?: string
          shop_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "expense_categories_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expense_categories_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "expense_categories_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_transactions: {
        Row: {
          amount: number
          category_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          expense_category_id: string | null
          id: string
          occurred_at: string
          payment_method: string | null
          related_sale_id: string | null
          shop_id: string
          type: Database["public"]["Enums"]["financial_tx_type"]
        }
        Insert: {
          amount: number
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          expense_category_id?: string | null
          id?: string
          occurred_at: string
          payment_method?: string | null
          related_sale_id?: string | null
          shop_id: string
          type: Database["public"]["Enums"]["financial_tx_type"]
        }
        Update: {
          amount?: number
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          expense_category_id?: string | null
          id?: string
          occurred_at?: string
          payment_method?: string | null
          related_sale_id?: string | null
          shop_id?: string
          type?: Database["public"]["Enums"]["financial_tx_type"]
        }
        Relationships: [
          {
            foreignKeyName: "financial_transactions_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "expense_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_transactions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_transactions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "financial_transactions_expense_category_id_fkey"
            columns: ["expense_category_id"]
            isOneToOne: false
            referencedRelation: "expense_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_transactions_related_sale_id_fkey"
            columns: ["related_sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_transactions_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_adjustments: {
        Row: {
          adjusted_by: string | null
          created_at: string
          id: string
          inventory_item_id: string
          new_status: Database["public"]["Enums"]["inventory_status"]
          old_status: Database["public"]["Enums"]["inventory_status"]
          reason: string
          shop_id: string
        }
        Insert: {
          adjusted_by?: string | null
          created_at?: string
          id?: string
          inventory_item_id: string
          new_status: Database["public"]["Enums"]["inventory_status"]
          old_status: Database["public"]["Enums"]["inventory_status"]
          reason: string
          shop_id: string
        }
        Update: {
          adjusted_by?: string | null
          created_at?: string
          id?: string
          inventory_item_id?: string
          new_status?: Database["public"]["Enums"]["inventory_status"]
          old_status?: Database["public"]["Enums"]["inventory_status"]
          reason?: string
          shop_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_adjustments_adjusted_by_fkey"
            columns: ["adjusted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_adjustments_adjusted_by_fkey"
            columns: ["adjusted_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "inventory_adjustments_inventory_item_id_fkey"
            columns: ["inventory_item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_adjustments_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_items: {
        Row: {
          created_at: string
          id: string
          lot_id: string
          qr_code_id: string
          sale_item_id: string | null
          shop_id: string
          sold_at: string | null
          status: Database["public"]["Enums"]["inventory_status"]
        }
        Insert: {
          created_at?: string
          id?: string
          lot_id: string
          qr_code_id: string
          sale_item_id?: string | null
          shop_id: string
          sold_at?: string | null
          status?: Database["public"]["Enums"]["inventory_status"]
        }
        Update: {
          created_at?: string
          id?: string
          lot_id?: string
          qr_code_id?: string
          sale_item_id?: string | null
          shop_id?: string
          sold_at?: string | null
          status?: Database["public"]["Enums"]["inventory_status"]
        }
        Relationships: [
          {
            foreignKeyName: "inventory_items_lot_id_fkey"
            columns: ["lot_id"]
            isOneToOne: false
            referencedRelation: "lots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_items_qr_code_id_fkey"
            columns: ["qr_code_id"]
            isOneToOne: true
            referencedRelation: "qr_codes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_items_sale_item_fk"
            columns: ["sale_item_id"]
            isOneToOne: false
            referencedRelation: "sale_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_items_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      lots: {
        Row: {
          category_id: string | null
          cost_price_per_unit: number
          created_at: string
          created_by: string | null
          date_of_stock_arrival: string
          free_text_size: string | null
          id: string
          min_margin_percent: number | null
          quantity: number
          sale_reason: string | null
          sale_type: string | null
          selling_price_default: number
          shop_id: string
          size_id: string | null
          tax_rate: number
          vendor_name: string | null
        }
        Insert: {
          category_id?: string | null
          cost_price_per_unit: number
          created_at?: string
          created_by?: string | null
          date_of_stock_arrival: string
          free_text_size?: string | null
          id?: string
          min_margin_percent?: number | null
          quantity: number
          sale_reason?: string | null
          sale_type?: string | null
          selling_price_default: number
          shop_id: string
          size_id?: string | null
          tax_rate?: number
          vendor_name?: string | null
        }
        Update: {
          category_id?: string | null
          cost_price_per_unit?: number
          created_at?: string
          created_by?: string | null
          date_of_stock_arrival?: string
          free_text_size?: string | null
          id?: string
          min_margin_percent?: number | null
          quantity?: number
          sale_reason?: string | null
          sale_type?: string | null
          selling_price_default?: number
          shop_id?: string
          size_id?: string | null
          tax_rate?: number
          vendor_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lots_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lots_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lots_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "lots_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lots_size_id_fkey"
            columns: ["size_id"]
            isOneToOne: false
            referencedRelation: "sizes"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string
          id: string
          is_active: boolean
          max_discount_percent: number
          phone: string | null
          role: Database["public"]["Enums"]["user_role"]
          shop_id: string | null
        }
        Insert: {
          created_at?: string
          full_name: string
          id: string
          is_active?: boolean
          max_discount_percent?: number
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          shop_id?: string | null
        }
        Update: {
          created_at?: string
          full_name?: string
          id?: string
          is_active?: boolean
          max_discount_percent?: number
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          shop_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      qr_codes: {
        Row: {
          assigned_at: string | null
          code: string
          created_at: string
          id: string
          prefix_id: string | null
          sequence_number: number | null
          shop_id: string
          sold_at: string | null
          status: Database["public"]["Enums"]["qr_status"]
        }
        Insert: {
          assigned_at?: string | null
          code: string
          created_at?: string
          id?: string
          prefix_id?: string | null
          sequence_number?: number | null
          shop_id: string
          sold_at?: string | null
          status?: Database["public"]["Enums"]["qr_status"]
        }
        Update: {
          assigned_at?: string | null
          code?: string
          created_at?: string
          id?: string
          prefix_id?: string | null
          sequence_number?: number | null
          shop_id?: string
          sold_at?: string | null
          status?: Database["public"]["Enums"]["qr_status"]
        }
        Relationships: [
          {
            foreignKeyName: "qr_codes_prefix_id_fkey"
            columns: ["prefix_id"]
            isOneToOne: false
            referencedRelation: "qr_prefixes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "qr_codes_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      qr_prefixes: {
        Row: {
          created_at: string
          description: string | null
          display_order: number
          id: string
          is_active: boolean
          prefix: string
          shop_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          is_active?: boolean
          prefix: string
          shop_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          is_active?: boolean
          prefix?: string
          shop_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "qr_prefixes_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      sale_items: {
        Row: {
          created_at: string
          discount_reason: string | null
          final_price: number
          id: string
          inventory_item_id: string
          original_price: number
          sale_id: string
          sale_type: string | null
          shop_id: string
          sold_on_sale: boolean
          tax_amount: number
        }
        Insert: {
          created_at?: string
          discount_reason?: string | null
          final_price: number
          id?: string
          inventory_item_id: string
          original_price: number
          sale_id: string
          sale_type?: string | null
          shop_id: string
          sold_on_sale?: boolean
          tax_amount?: number
        }
        Update: {
          created_at?: string
          discount_reason?: string | null
          final_price?: number
          id?: string
          inventory_item_id?: string
          original_price?: number
          sale_id?: string
          sale_type?: string | null
          shop_id?: string
          sold_on_sale?: boolean
          tax_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "sale_items_inventory_item_id_fkey"
            columns: ["inventory_item_id"]
            isOneToOne: true
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_items_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_items_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      sale_returns: {
        Row: {
          created_at: string
          id: string
          original_sale_id: string
          processed_by: string | null
          refund_amount: number | null
          return_reason: string | null
          return_sale_id: string | null
          returned_items: Json
          shop_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          original_sale_id: string
          processed_by?: string | null
          refund_amount?: number | null
          return_reason?: string | null
          return_sale_id?: string | null
          returned_items: Json
          shop_id: string
        }
        Update: {
          created_at?: string
          id?: string
          original_sale_id?: string
          processed_by?: string | null
          refund_amount?: number | null
          return_reason?: string | null
          return_sale_id?: string | null
          returned_items?: Json
          shop_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sale_returns_original_sale_id_fkey"
            columns: ["original_sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_returns_processed_by_fkey"
            columns: ["processed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_returns_processed_by_fkey"
            columns: ["processed_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "sale_returns_return_sale_id_fkey"
            columns: ["return_sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_returns_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      sales: {
        Row: {
          bill_number: number | null
          client_sale_id: string | null
          created_at: string
          created_by: string | null
          customer_name: string | null
          customer_phone: string | null
          id: string
          payment_method: string
          shop_id: string
          subtotal_amount: number
          total_amount: number
          total_discount: number
          total_tax: number
        }
        Insert: {
          bill_number?: number | null
          client_sale_id?: string | null
          created_at?: string
          created_by?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          id?: string
          payment_method: string
          shop_id: string
          subtotal_amount: number
          total_amount: number
          total_discount: number
          total_tax?: number
        }
        Update: {
          bill_number?: number | null
          client_sale_id?: string | null
          created_at?: string
          created_by?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          id?: string
          payment_method?: string
          shop_id?: string
          subtotal_amount?: number
          total_amount?: number
          total_discount?: number
          total_tax?: number
        }
        Relationships: [
          {
            foreignKeyName: "sales_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "sales_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      shops: {
        Row: {
          address: string | null
          bill_prefix: string
          created_at: string
          id: string
          phone: string | null
          shop_name: string
          tax_rate: number
        }
        Insert: {
          address?: string | null
          bill_prefix?: string
          created_at?: string
          id?: string
          phone?: string | null
          shop_name: string
          tax_rate?: number
        }
        Update: {
          address?: string | null
          bill_prefix?: string
          created_at?: string
          id?: string
          phone?: string | null
          shop_name?: string
          tax_rate?: number
        }
        Relationships: []
      }
      sizes: {
        Row: {
          created_at: string
          id: string
          shop_id: string
          size_name: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          id?: string
          shop_id: string
          size_name: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          id?: string
          shop_id?: string
          size_name?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "sizes_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      tax_settings: {
        Row: {
          default_tax_rate: number
          gst_number: string | null
          is_tax_inclusive: boolean
          shop_id: string
        }
        Insert: {
          default_tax_rate?: number
          gst_number?: string | null
          is_tax_inclusive?: boolean
          shop_id: string
        }
        Update: {
          default_tax_rate?: number
          gst_number?: string | null
          is_tax_inclusive?: boolean
          shop_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tax_settings_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: true
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      user_profiles: {
        Row: {
          role: Database["public"]["Enums"]["user_role"] | null
          shop_id: string | null
          user_id: string | null
        }
        Insert: {
          role?: Database["public"]["Enums"]["user_role"] | null
          shop_id?: string | null
          user_id?: string | null
        }
        Update: {
          role?: Database["public"]["Enums"]["user_role"] | null
          shop_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      create_daily_checklist_instances: {
        Args: { date_param?: string; shop_id_param: string }
        Returns: {
          checklist_name: string
          instance_id: string
          items_count: number
        }[]
      }
      current_profile: { Args: never; Returns: string }
      current_role: {
        Args: never
        Returns: Database["public"]["Enums"]["user_role"]
      }
      current_shop_id: { Args: never; Returns: string }
      generate_bill_number: { Args: { p_shop_id: string }; Returns: number }
      generate_qr_codes_with_prefix: {
        Args: { p_prefix_id: string; p_quantity: number; p_shop_id: string }
        Returns: {
          qr_code: string
          qr_code_id: string
        }[]
      }
      get_prefix_qr_stats: {
        Args: { p_prefix_id: string; p_shop_id: string }
        Returns: {
          assigned_qr_codes: number
          lost_qr_codes: number
          sold_qr_codes: number
          total_qr_codes: number
          unused_qr_codes: number
        }[]
      }
      is_admin: { Args: never; Returns: boolean }
      is_staff_or_higher: { Args: never; Returns: boolean }
      is_superadmin: { Args: never; Returns: boolean }
      migrate_legacy_qr_codes_to_default_prefix: {
        Args: { p_shop_id: string }
        Returns: {
          migrated_count: number
        }[]
      }
    }
    Enums: {
      attendance_status: "open" | "closed"
      checklist_item_status: "pending" | "done" | "na"
      checklist_status: "pending" | "completed" | "partial"
      financial_tx_type: "sale" | "expense" | "adjustment"
      inventory_status:
        | "available"
        | "reserved"
        | "sold"
        | "damaged"
        | "returned"
      qr_status: "unused" | "assigned" | "sold" | "lost"
      user_role: "superadmin" | "owner" | "admin" | "staff"
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
      attendance_status: ["open", "closed"],
      checklist_item_status: ["pending", "done", "na"],
      checklist_status: ["pending", "completed", "partial"],
      financial_tx_type: ["sale", "expense", "adjustment"],
      inventory_status: [
        "available",
        "reserved",
        "sold",
        "damaged",
        "returned",
      ],
      qr_status: ["unused", "assigned", "sold", "lost"],
      user_role: ["superadmin", "owner", "admin", "staff"],
    },
  },
} as const
