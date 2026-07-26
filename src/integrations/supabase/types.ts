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
      account_deletion_requests: {
        Row: {
          id: string
          processed_at: string | null
          reason: string | null
          requested_at: string
          status: string
          user_id: string
        }
        Insert: {
          id?: string
          processed_at?: string | null
          reason?: string | null
          requested_at?: string
          status?: string
          user_id: string
        }
        Update: {
          id?: string
          processed_at?: string | null
          reason?: string | null
          requested_at?: string
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      accounts: {
        Row: {
          amount: number
          category_id: string | null
          created_at: string
          created_by: string
          customer_id: string | null
          description: string
          due_date: string
          id: string
          notes: string | null
          paid_amount: number | null
          paid_at: string | null
          party_name: string | null
          payment_method: string | null
          status: string
          tenant_id: string
          type: string
          updated_at: string
        }
        Insert: {
          amount: number
          category_id?: string | null
          created_at?: string
          created_by: string
          customer_id?: string | null
          description: string
          due_date: string
          id?: string
          notes?: string | null
          paid_amount?: number | null
          paid_at?: string | null
          party_name?: string | null
          payment_method?: string | null
          status?: string
          tenant_id: string
          type: string
          updated_at?: string
        }
        Update: {
          amount?: number
          category_id?: string | null
          created_at?: string
          created_by?: string
          customer_id?: string | null
          description?: string
          due_date?: string
          id?: string
          notes?: string | null
          paid_amount?: number | null
          paid_at?: string | null
          party_name?: string | null
          payment_method?: string | null
          status?: string
          tenant_id?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "accounts_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "financial_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string | null
          entity_id: string | null
          entity_type: string
          id: string
          ip_address: string | null
          new_data: Json | null
          old_data: Json | null
          tenant_id: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          entity_id?: string | null
          entity_type: string
          id?: string
          ip_address?: string | null
          new_data?: Json | null
          old_data?: Json | null
          tenant_id: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string | null
          entity_id?: string | null
          entity_type?: string
          id?: string
          ip_address?: string | null
          new_data?: Json | null
          old_data?: Json | null
          tenant_id?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      cash_movements: {
        Row: {
          amount: number
          created_at: string | null
          description: string | null
          id: string
          movement_type: string
          payment_method: string | null
          sale_id: string | null
          session_id: string
          tenant_id: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string | null
          description?: string | null
          id?: string
          movement_type: string
          payment_method?: string | null
          sale_id?: string | null
          session_id: string
          tenant_id: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string | null
          description?: string | null
          id?: string
          movement_type?: string
          payment_method?: string | null
          sale_id?: string | null
          session_id?: string
          tenant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cash_movements_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_movements_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "cash_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_movements_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      cash_registers: {
        Row: {
          active: boolean | null
          code: string
          created_at: string | null
          id: string
          name: string
          tenant_id: string
        }
        Insert: {
          active?: boolean | null
          code: string
          created_at?: string | null
          id?: string
          name: string
          tenant_id: string
        }
        Update: {
          active?: boolean | null
          code?: string
          created_at?: string | null
          id?: string
          name?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cash_registers_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      cash_sessions: {
        Row: {
          closed_at: string | null
          closing_balance: number | null
          created_at: string | null
          difference: number | null
          difference_reason: string | null
          discrepancy_by_method: Json | null
          expected_balance: number | null
          id: string
          notes: string | null
          opened_at: string
          opening_balance: number
          register_id: string
          status: string
          tenant_id: string
          user_id: string
        }
        Insert: {
          closed_at?: string | null
          closing_balance?: number | null
          created_at?: string | null
          difference?: number | null
          difference_reason?: string | null
          discrepancy_by_method?: Json | null
          expected_balance?: number | null
          id?: string
          notes?: string | null
          opened_at?: string
          opening_balance?: number
          register_id: string
          status?: string
          tenant_id: string
          user_id: string
        }
        Update: {
          closed_at?: string | null
          closing_balance?: number | null
          created_at?: string | null
          difference?: number | null
          difference_reason?: string | null
          discrepancy_by_method?: Json | null
          expected_balance?: number | null
          id?: string
          notes?: string | null
          opened_at?: string
          opening_balance?: number
          register_id?: string
          status?: string
          tenant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cash_sessions_register_id_fkey"
            columns: ["register_id"]
            isOneToOne: false
            referencedRelation: "cash_registers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_sessions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_credits: {
        Row: {
          amount: number
          created_at: string | null
          customer_id: string
          description: string | null
          expires_at: string | null
          id: string
          origin_id: string | null
          origin_type: string
          tenant_id: string
          used_amount: number | null
        }
        Insert: {
          amount: number
          created_at?: string | null
          customer_id: string
          description?: string | null
          expires_at?: string | null
          id?: string
          origin_id?: string | null
          origin_type: string
          tenant_id: string
          used_amount?: number | null
        }
        Update: {
          amount?: number
          created_at?: string | null
          customer_id?: string
          description?: string | null
          expires_at?: string | null
          id?: string
          origin_id?: string | null
          origin_type?: string
          tenant_id?: string
          used_amount?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_credits_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_credits_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers_active"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_credits_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_points: {
        Row: {
          created_at: string | null
          customer_id: string
          description: string | null
          expires_at: string | null
          id: string
          movement_type: string
          points: number
          sale_id: string | null
          tenant_id: string
        }
        Insert: {
          created_at?: string | null
          customer_id: string
          description?: string | null
          expires_at?: string | null
          id?: string
          movement_type: string
          points: number
          sale_id?: string | null
          tenant_id: string
        }
        Update: {
          created_at?: string | null
          customer_id?: string
          description?: string | null
          expires_at?: string | null
          id?: string
          movement_type?: string
          points?: number
          sale_id?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_points_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_points_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers_active"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_points_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_points_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          created_at: string | null
          deleted_at: string | null
          document: string | null
          email: string | null
          id: string
          name: string
          notes: string | null
          phone: string | null
          tenant_id: string
        }
        Insert: {
          created_at?: string | null
          deleted_at?: string | null
          document?: string | null
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          tenant_id: string
        }
        Update: {
          created_at?: string | null
          deleted_at?: string | null
          document?: string | null
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "customers_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      employees: {
        Row: {
          active: boolean
          birth_date: string | null
          contract_type: string | null
          cpf: string | null
          created_at: string | null
          deleted_at: string | null
          department: string | null
          email: string | null
          hire_date: string | null
          id: string
          name: string
          notes: string | null
          phone: string | null
          photo_url: string | null
          rg: string | null
          role: string | null
          salary: number | null
          tenant_id: string
          termination_date: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          active?: boolean
          birth_date?: string | null
          contract_type?: string | null
          cpf?: string | null
          created_at?: string | null
          deleted_at?: string | null
          department?: string | null
          email?: string | null
          hire_date?: string | null
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          photo_url?: string | null
          rg?: string | null
          role?: string | null
          salary?: number | null
          tenant_id: string
          termination_date?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          active?: boolean
          birth_date?: string | null
          contract_type?: string | null
          cpf?: string | null
          created_at?: string | null
          deleted_at?: string | null
          department?: string | null
          email?: string | null
          hire_date?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          photo_url?: string | null
          rg?: string | null
          role?: string | null
          salary?: number | null
          tenant_id?: string
          termination_date?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employees_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_categories: {
        Row: {
          color: string
          created_at: string
          id: string
          name: string
          tenant_id: string
          type: string
          updated_at: string
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          name: string
          tenant_id: string
          type: string
          updated_at?: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          name?: string
          tenant_id?: string
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      financial_entries: {
        Row: {
          amount: number
          created_at: string | null
          description: string
          entry_date: string
          id: string
          payment_method: string | null
          sale_id: string | null
          tenant_id: string
          type: string
        }
        Insert: {
          amount: number
          created_at?: string | null
          description: string
          entry_date?: string
          id?: string
          payment_method?: string | null
          sale_id?: string | null
          tenant_id: string
          type: string
        }
        Update: {
          amount?: number
          created_at?: string | null
          description?: string
          entry_date?: string
          id?: string
          payment_method?: string | null
          sale_id?: string | null
          tenant_id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "financial_entries_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_entries_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      fiscal_documents: {
        Row: {
          ambiente: string
          chave_acesso: string | null
          created_at: string
          created_by: string | null
          danfe_url: string | null
          document_type: string
          id: string
          numero_nota: number | null
          obs: string | null
          protocolo: string | null
          sale_id: string | null
          serie: string
          status: string
          tenant_id: string
          updated_at: string
          valor_impostos: number
          valor_total: number
          xml_content: string | null
        }
        Insert: {
          ambiente?: string
          chave_acesso?: string | null
          created_at?: string
          created_by?: string | null
          danfe_url?: string | null
          document_type?: string
          id?: string
          numero_nota?: number | null
          obs?: string | null
          protocolo?: string | null
          sale_id?: string | null
          serie?: string
          status?: string
          tenant_id: string
          updated_at?: string
          valor_impostos?: number
          valor_total?: number
          xml_content?: string | null
        }
        Update: {
          ambiente?: string
          chave_acesso?: string | null
          created_at?: string
          created_by?: string | null
          danfe_url?: string | null
          document_type?: string
          id?: string
          numero_nota?: number | null
          obs?: string | null
          protocolo?: string | null
          sale_id?: string | null
          serie?: string
          status?: string
          tenant_id?: string
          updated_at?: string
          valor_impostos?: number
          valor_total?: number
          xml_content?: string | null
        }
        Relationships: []
      }
      inventory_count_items: {
        Row: {
          adjustment_reason: string | null
          count_id: string
          counted_at: string | null
          counted_by: string | null
          counted_quantity: number | null
          difference: number | null
          difference_value: number | null
          expected_quantity: number
          id: string
          product_id: string
        }
        Insert: {
          adjustment_reason?: string | null
          count_id: string
          counted_at?: string | null
          counted_by?: string | null
          counted_quantity?: number | null
          difference?: number | null
          difference_value?: number | null
          expected_quantity: number
          id?: string
          product_id: string
        }
        Update: {
          adjustment_reason?: string | null
          count_id?: string
          counted_at?: string | null
          counted_by?: string | null
          counted_quantity?: number | null
          difference?: number | null
          difference_value?: number | null
          expected_quantity?: number
          id?: string
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_count_items_count_id_fkey"
            columns: ["count_id"]
            isOneToOne: false
            referencedRelation: "inventory_counts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_count_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_count_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_active"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_counts: {
        Row: {
          completed_at: string | null
          completed_by: string | null
          created_at: string | null
          created_by: string
          id: string
          name: string
          notes: string | null
          started_at: string | null
          status: string
          tenant_id: string
          total_difference_value: number | null
          total_products: number | null
        }
        Insert: {
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string | null
          created_by: string
          id?: string
          name: string
          notes?: string | null
          started_at?: string | null
          status?: string
          tenant_id: string
          total_difference_value?: number | null
          total_products?: number | null
        }
        Update: {
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string | null
          created_by?: string
          id?: string
          name?: string
          notes?: string | null
          started_at?: string | null
          status?: string
          tenant_id?: string
          total_difference_value?: number | null
          total_products?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_counts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_methods: {
        Row: {
          active: boolean | null
          allows_installments: boolean | null
          code: string
          created_at: string | null
          display_order: number | null
          fee_percentage: number | null
          id: string
          max_installments: number | null
          name: string
          requires_change: boolean | null
          tenant_id: string
          type: string
        }
        Insert: {
          active?: boolean | null
          allows_installments?: boolean | null
          code: string
          created_at?: string | null
          display_order?: number | null
          fee_percentage?: number | null
          id?: string
          max_installments?: number | null
          name: string
          requires_change?: boolean | null
          tenant_id: string
          type: string
        }
        Update: {
          active?: boolean | null
          allows_installments?: boolean | null
          code?: string
          created_at?: string | null
          display_order?: number | null
          fee_percentage?: number | null
          id?: string
          max_installments?: number | null
          name?: string
          requires_change?: boolean | null
          tenant_id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_methods_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      printer_configs: {
        Row: {
          active: boolean | null
          connection_type: string
          created_at: string | null
          id: string
          ip_address: string | null
          is_default: boolean | null
          name: string
          paper_width: number | null
          port: number | null
          printer_type: string
          tenant_id: string
        }
        Insert: {
          active?: boolean | null
          connection_type?: string
          created_at?: string | null
          id?: string
          ip_address?: string | null
          is_default?: boolean | null
          name: string
          paper_width?: number | null
          port?: number | null
          printer_type?: string
          tenant_id: string
        }
        Update: {
          active?: boolean | null
          connection_type?: string
          created_at?: string | null
          id?: string
          ip_address?: string | null
          is_default?: boolean | null
          name?: string
          paper_width?: number | null
          port?: number | null
          printer_type?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "printer_configs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      product_barcodes: {
        Row: {
          barcode: string
          barcode_type: string
          created_at: string | null
          id: string
          is_primary: boolean | null
          product_id: string
          tenant_id: string
        }
        Insert: {
          barcode: string
          barcode_type?: string
          created_at?: string | null
          id?: string
          is_primary?: boolean | null
          product_id: string
          tenant_id: string
        }
        Update: {
          barcode?: string
          barcode_type?: string
          created_at?: string | null
          id?: string
          is_primary?: boolean | null
          product_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_barcodes_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_barcodes_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_active"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_barcodes_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      product_images: {
        Row: {
          created_at: string
          id: string
          is_primary: boolean
          position: number
          product_id: string
          public_url: string | null
          storage_path: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_primary?: boolean
          position?: number
          product_id: string
          public_url?: string | null
          storage_path: string
          tenant_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_primary?: boolean
          position?: number
          product_id?: string
          public_url?: string | null
          storage_path?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_images_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_images_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_active"
            referencedColumns: ["id"]
          },
        ]
      }
      product_kits: {
        Row: {
          child_product_id: string
          created_at: string
          id: string
          parent_product_id: string
          quantity: number
          tenant_id: string
        }
        Insert: {
          child_product_id: string
          created_at?: string
          id?: string
          parent_product_id: string
          quantity?: number
          tenant_id: string
        }
        Update: {
          child_product_id?: string
          created_at?: string
          id?: string
          parent_product_id?: string
          quantity?: number
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_kits_child_product_id_fkey"
            columns: ["child_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_kits_child_product_id_fkey"
            columns: ["child_product_id"]
            isOneToOne: false
            referencedRelation: "products_active"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_kits_parent_product_id_fkey"
            columns: ["parent_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_kits_parent_product_id_fkey"
            columns: ["parent_product_id"]
            isOneToOne: false
            referencedRelation: "products_active"
            referencedColumns: ["id"]
          },
        ]
      }
      product_lots: {
        Row: {
          cost_price: number | null
          created_at: string | null
          expiry_date: string | null
          id: string
          lot_number: string
          manufacture_date: string | null
          notes: string | null
          product_id: string
          quantity: number
          status: string
          supplier_info: string | null
          tenant_id: string
        }
        Insert: {
          cost_price?: number | null
          created_at?: string | null
          expiry_date?: string | null
          id?: string
          lot_number: string
          manufacture_date?: string | null
          notes?: string | null
          product_id: string
          quantity?: number
          status?: string
          supplier_info?: string | null
          tenant_id: string
        }
        Update: {
          cost_price?: number | null
          created_at?: string | null
          expiry_date?: string | null
          id?: string
          lot_number?: string
          manufacture_date?: string | null
          notes?: string | null
          product_id?: string
          quantity?: number
          status?: string
          supplier_info?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_lots_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_lots_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_active"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_lots_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      product_variants: {
        Row: {
          active: boolean
          attributes: Json
          barcode: string | null
          cost_price: number | null
          created_at: string
          id: string
          product_id: string
          sale_price: number | null
          sku: string
          stock_current: number
          tenant_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          attributes?: Json
          barcode?: string | null
          cost_price?: number | null
          created_at?: string
          id?: string
          product_id: string
          sale_price?: number | null
          sku: string
          stock_current?: number
          tenant_id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          attributes?: Json
          barcode?: string | null
          cost_price?: number | null
          created_at?: string
          id?: string
          product_id?: string
          sale_price?: number | null
          sku?: string
          stock_current?: number
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_variants_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_variants_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_active"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          active: boolean | null
          barcode: string | null
          category: string | null
          cest: string | null
          cfop: string | null
          cofins_aliquota: number | null
          controls_lot: boolean | null
          cost_price: number | null
          created_at: string | null
          csosn: string | null
          cst_icms: string | null
          deleted_at: string | null
          ean: string | null
          extra_attributes: Json | null
          icms_aliquota: number | null
          id: string
          internal_code: string | null
          min_stock: number | null
          name: string
          ncm: string | null
          origem: number | null
          pis_aliquota: number | null
          sale_price: number
          stock_current: number | null
          tenant_id: string
          unidade_medida: string | null
          unit: string | null
          updated_at: string | null
          weighted_avg_cost: number | null
          wholesale_min_qty: number | null
          wholesale_price: number | null
        }
        Insert: {
          active?: boolean | null
          barcode?: string | null
          category?: string | null
          cest?: string | null
          cfop?: string | null
          cofins_aliquota?: number | null
          controls_lot?: boolean | null
          cost_price?: number | null
          created_at?: string | null
          csosn?: string | null
          cst_icms?: string | null
          deleted_at?: string | null
          ean?: string | null
          extra_attributes?: Json | null
          icms_aliquota?: number | null
          id?: string
          internal_code?: string | null
          min_stock?: number | null
          name: string
          ncm?: string | null
          origem?: number | null
          pis_aliquota?: number | null
          sale_price: number
          stock_current?: number | null
          tenant_id: string
          unidade_medida?: string | null
          unit?: string | null
          updated_at?: string | null
          weighted_avg_cost?: number | null
          wholesale_min_qty?: number | null
          wholesale_price?: number | null
        }
        Update: {
          active?: boolean | null
          barcode?: string | null
          category?: string | null
          cest?: string | null
          cfop?: string | null
          cofins_aliquota?: number | null
          controls_lot?: boolean | null
          cost_price?: number | null
          created_at?: string | null
          csosn?: string | null
          cst_icms?: string | null
          deleted_at?: string | null
          ean?: string | null
          extra_attributes?: Json | null
          icms_aliquota?: number | null
          id?: string
          internal_code?: string | null
          min_stock?: number | null
          name?: string
          ncm?: string | null
          origem?: number | null
          pis_aliquota?: number | null
          sale_price?: number
          stock_current?: number | null
          tenant_id?: string
          unidade_medida?: string | null
          unit?: string | null
          updated_at?: string | null
          weighted_avg_cost?: number | null
          wholesale_min_qty?: number | null
          wholesale_price?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "products_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      promotions: {
        Row: {
          active: boolean
          category: string | null
          created_at: string
          created_by: string
          description: string | null
          discount_type: string
          discount_value: number
          ends_at: string | null
          id: string
          min_quantity: number | null
          name: string
          product_ids: string[] | null
          scope: string
          starts_at: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          category?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          discount_type: string
          discount_value: number
          ends_at?: string | null
          id?: string
          min_quantity?: number | null
          name: string
          product_ids?: string[] | null
          scope?: string
          starts_at?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          category?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          discount_type?: string
          discount_value?: number
          ends_at?: string | null
          id?: string
          min_quantity?: number | null
          name?: string
          product_ids?: string[] | null
          scope?: string
          starts_at?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "promotions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_order_items: {
        Row: {
          id: string
          order_id: string
          product_id: string
          quantity_ordered: number
          quantity_received: number
          total: number
          unit_cost: number
        }
        Insert: {
          id?: string
          order_id: string
          product_id: string
          quantity_ordered: number
          quantity_received?: number
          total: number
          unit_cost: number
        }
        Update: {
          id?: string
          order_id?: string
          product_id?: string
          quantity_ordered?: number
          quantity_received?: number
          total?: number
          unit_cost?: number
        }
        Relationships: [
          {
            foreignKeyName: "purchase_order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_active"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_orders: {
        Row: {
          created_at: string
          created_by: string
          discount: number
          expected_date: string | null
          freight: number
          id: string
          notes: string | null
          order_number: string | null
          received_date: string | null
          status: string
          supplier_id: string
          tenant_id: string
          total_cost: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          discount?: number
          expected_date?: string | null
          freight?: number
          id?: string
          notes?: string | null
          order_number?: string | null
          received_date?: string | null
          status?: string
          supplier_id: string
          tenant_id: string
          total_cost?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          discount?: number
          expected_date?: string | null
          freight?: number
          id?: string
          notes?: string | null
          order_number?: string | null
          received_date?: string | null
          status?: string
          supplier_id?: string
          tenant_id?: string
          total_cost?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_orders_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      sale_items: {
        Row: {
          discount: number | null
          id: string
          product_id: string
          quantity: number
          sale_id: string
          total: number
          unit_price: number
        }
        Insert: {
          discount?: number | null
          id?: string
          product_id: string
          quantity: number
          sale_id: string
          total: number
          unit_price: number
        }
        Update: {
          discount?: number | null
          id?: string
          product_id?: string
          quantity?: number
          sale_id?: string
          total?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "sale_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_active"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_items_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      sale_payments: {
        Row: {
          amount: number
          authorization_code: string | null
          change_amount: number | null
          created_at: string | null
          id: string
          installments: number | null
          payment_method_code: string
          payment_method_id: string | null
          sale_id: string
        }
        Insert: {
          amount: number
          authorization_code?: string | null
          change_amount?: number | null
          created_at?: string | null
          id?: string
          installments?: number | null
          payment_method_code: string
          payment_method_id?: string | null
          sale_id: string
        }
        Update: {
          amount?: number
          authorization_code?: string | null
          change_amount?: number | null
          created_at?: string | null
          id?: string
          installments?: number | null
          payment_method_code?: string
          payment_method_id?: string | null
          sale_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sale_payments_payment_method_id_fkey"
            columns: ["payment_method_id"]
            isOneToOne: false
            referencedRelation: "payment_methods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_payments_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      sale_return_items: {
        Row: {
          id: string
          product_id: string
          quantity: number
          return_id: string
          sale_item_id: string
          total: number
          unit_price: number
        }
        Insert: {
          id?: string
          product_id: string
          quantity: number
          return_id: string
          sale_item_id: string
          total: number
          unit_price: number
        }
        Update: {
          id?: string
          product_id?: string
          quantity?: number
          return_id?: string
          sale_item_id?: string
          total?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "sale_return_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_return_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_active"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_return_items_return_id_fkey"
            columns: ["return_id"]
            isOneToOne: false
            referencedRelation: "sale_returns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_return_items_sale_item_id_fkey"
            columns: ["sale_item_id"]
            isOneToOne: false
            referencedRelation: "sale_items"
            referencedColumns: ["id"]
          },
        ]
      }
      sale_returns: {
        Row: {
          created_at: string
          created_by: string
          id: string
          notes: string | null
          reason: string
          reason_type: string
          refund_method: string
          refund_reference_id: string | null
          sale_id: string
          session_id: string | null
          tenant_id: string
          total_amount: number
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          notes?: string | null
          reason: string
          reason_type?: string
          refund_method: string
          refund_reference_id?: string | null
          sale_id: string
          session_id?: string | null
          tenant_id: string
          total_amount?: number
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          notes?: string | null
          reason?: string
          reason_type?: string
          refund_method?: string
          refund_reference_id?: string | null
          sale_id?: string
          session_id?: string | null
          tenant_id?: string
          total_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "sale_returns_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_returns_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "cash_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_returns_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      sales: {
        Row: {
          created_at: string | null
          customer_id: string | null
          datetime: string
          discount_total: number | null
          gross_total: number
          id: string
          net_total: number
          notes: string | null
          payment_method: string
          session_id: string | null
          tenant_id: string
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          customer_id?: string | null
          datetime?: string
          discount_total?: number | null
          gross_total: number
          id?: string
          net_total: number
          notes?: string | null
          payment_method: string
          session_id?: string | null
          tenant_id: string
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          customer_id?: string | null
          datetime?: string
          discount_total?: number | null
          gross_total?: number
          id?: string
          net_total?: number
          notes?: string | null
          payment_method?: string
          session_id?: string | null
          tenant_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sales_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers_active"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "cash_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_by_warehouse: {
        Row: {
          id: string
          product_id: string
          quantity: number
          reserved: number
          tenant_id: string
          updated_at: string
          warehouse_id: string
        }
        Insert: {
          id?: string
          product_id: string
          quantity?: number
          reserved?: number
          tenant_id: string
          updated_at?: string
          warehouse_id: string
        }
        Update: {
          id?: string
          product_id?: string
          quantity?: number
          reserved?: number
          tenant_id?: string
          updated_at?: string
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_by_warehouse_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_by_warehouse_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_active"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_by_warehouse_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_movements: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          movement_type: string
          product_id: string
          quantity: number
          sale_id: string | null
          tenant_id: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          movement_type: string
          product_id: string
          quantity: number
          sale_id?: string | null
          tenant_id: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          movement_type?: string
          product_id?: string
          quantity?: number
          sale_id?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_active"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_reservations: {
        Row: {
          created_at: string
          expires_at: string | null
          id: string
          product_id: string
          quantity: number
          reference_id: string | null
          reference_type: string | null
          status: string
          tenant_id: string
          warehouse_id: string | null
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          id?: string
          product_id: string
          quantity: number
          reference_id?: string | null
          reference_type?: string | null
          status?: string
          tenant_id: string
          warehouse_id?: string | null
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          id?: string
          product_id?: string
          quantity?: number
          reference_id?: string | null
          reference_type?: string | null
          status?: string
          tenant_id?: string
          warehouse_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_reservations_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_reservations_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_active"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_reservations_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_transfers: {
        Row: {
          completed_at: string | null
          created_at: string
          created_by: string | null
          from_warehouse_id: string
          id: string
          notes: string | null
          product_id: string
          quantity: number
          status: string
          tenant_id: string
          to_warehouse_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          from_warehouse_id: string
          id?: string
          notes?: string | null
          product_id: string
          quantity: number
          status?: string
          tenant_id: string
          to_warehouse_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          from_warehouse_id?: string
          id?: string
          notes?: string | null
          product_id?: string
          quantity?: number
          status?: string
          tenant_id?: string
          to_warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_transfers_from_warehouse_id_fkey"
            columns: ["from_warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_transfers_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_transfers_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_active"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_transfers_to_warehouse_id_fkey"
            columns: ["to_warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          active: boolean
          address: string | null
          bank_account: string | null
          bank_agency: string | null
          bank_name: string | null
          category: string | null
          city: string | null
          complement: string | null
          created_at: string
          deleted_at: string | null
          document: string | null
          due_days: number
          email: string | null
          fantasy_name: string | null
          id: string
          name: string
          neighborhood: string | null
          notes: string | null
          number: string | null
          payment_terms: string | null
          phone: string | null
          pix_key: string | null
          state: string | null
          state_registration: string | null
          street: string | null
          tenant_id: string
          updated_at: string
          zip_code: string | null
        }
        Insert: {
          active?: boolean
          address?: string | null
          bank_account?: string | null
          bank_agency?: string | null
          bank_name?: string | null
          category?: string | null
          city?: string | null
          complement?: string | null
          created_at?: string
          deleted_at?: string | null
          document?: string | null
          due_days?: number
          email?: string | null
          fantasy_name?: string | null
          id?: string
          name: string
          neighborhood?: string | null
          notes?: string | null
          number?: string | null
          payment_terms?: string | null
          phone?: string | null
          pix_key?: string | null
          state?: string | null
          state_registration?: string | null
          street?: string | null
          tenant_id: string
          updated_at?: string
          zip_code?: string | null
        }
        Update: {
          active?: boolean
          address?: string | null
          bank_account?: string | null
          bank_agency?: string | null
          bank_name?: string | null
          category?: string | null
          city?: string | null
          complement?: string | null
          created_at?: string
          deleted_at?: string | null
          document?: string | null
          due_days?: number
          email?: string | null
          fantasy_name?: string | null
          id?: string
          name?: string
          neighborhood?: string | null
          notes?: string | null
          number?: string | null
          payment_terms?: string | null
          phone?: string | null
          pix_key?: string | null
          state?: string | null
          state_registration?: string | null
          street?: string | null
          tenant_id?: string
          updated_at?: string
          zip_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "suppliers_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      system_users: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["system_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["system_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["system_role"]
          user_id?: string
        }
        Relationships: []
      }
      tab_items: {
        Row: {
          added_at: string | null
          added_by: string | null
          discount: number | null
          id: string
          notes: string | null
          product_id: string
          quantity: number
          tab_id: string
          total: number
          unit_price: number
        }
        Insert: {
          added_at?: string | null
          added_by?: string | null
          discount?: number | null
          id?: string
          notes?: string | null
          product_id: string
          quantity: number
          tab_id: string
          total: number
          unit_price: number
        }
        Update: {
          added_at?: string | null
          added_by?: string | null
          discount?: number | null
          id?: string
          notes?: string | null
          product_id?: string
          quantity?: number
          tab_id?: string
          total?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "tab_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tab_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_active"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tab_items_tab_id_fkey"
            columns: ["tab_id"]
            isOneToOne: false
            referencedRelation: "tabs"
            referencedColumns: ["id"]
          },
        ]
      }
      tables: {
        Row: {
          capacity: number | null
          created_at: string | null
          id: string
          name: string | null
          number: string
          status: string | null
          tenant_id: string
        }
        Insert: {
          capacity?: number | null
          created_at?: string | null
          id?: string
          name?: string | null
          number: string
          status?: string | null
          tenant_id: string
        }
        Update: {
          capacity?: number | null
          created_at?: string | null
          id?: string
          name?: string | null
          number?: string
          status?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tables_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tabs: {
        Row: {
          closed_at: string | null
          created_at: string | null
          customer_name: string | null
          id: string
          notes: string | null
          opened_at: string | null
          status: string | null
          table_id: string | null
          tenant_id: string
          user_id: string | null
        }
        Insert: {
          closed_at?: string | null
          created_at?: string | null
          customer_name?: string | null
          id?: string
          notes?: string | null
          opened_at?: string | null
          status?: string | null
          table_id?: string | null
          tenant_id: string
          user_id?: string | null
        }
        Update: {
          closed_at?: string | null
          created_at?: string | null
          customer_name?: string | null
          id?: string
          notes?: string | null
          opened_at?: string | null
          status?: string | null
          table_id?: string | null
          tenant_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tabs_table_id_fkey"
            columns: ["table_id"]
            isOneToOne: false
            referencedRelation: "tables"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tabs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_invitations: {
        Row: {
          accepted_at: string | null
          created_at: string | null
          email: string
          expires_at: string
          id: string
          invited_by: string
          role: Database["public"]["Enums"]["app_role"]
          tenant_id: string
          token: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string | null
          email: string
          expires_at?: string
          id?: string
          invited_by: string
          role?: Database["public"]["Enums"]["app_role"]
          tenant_id: string
          token?: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string | null
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string
          role?: Database["public"]["Enums"]["app_role"]
          tenant_id?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_invitations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_users: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          tenant_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          tenant_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          tenant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_users_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          created_at: string | null
          document: string | null
          id: string
          name: string
          phone: string | null
          segment: string | null
          settings: Json | null
          subscription_expires_at: string | null
          subscription_status: string | null
        }
        Insert: {
          created_at?: string | null
          document?: string | null
          id?: string
          name: string
          phone?: string | null
          segment?: string | null
          settings?: Json | null
          subscription_expires_at?: string | null
          subscription_status?: string | null
        }
        Update: {
          created_at?: string | null
          document?: string | null
          id?: string
          name?: string
          phone?: string | null
          segment?: string | null
          settings?: Json | null
          subscription_expires_at?: string | null
          subscription_status?: string | null
        }
        Relationships: []
      }
      user_activity: {
        Row: {
          last_seen: string
          user_id: string
        }
        Insert: {
          last_seen?: string
          user_id: string
        }
        Update: {
          last_seen?: string
          user_id?: string
        }
        Relationships: []
      }
      user_consents: {
        Row: {
          accepted: boolean
          consent_type: string
          created_at: string
          id: string
          ip_address: string | null
          user_agent: string | null
          user_id: string
          version: string
        }
        Insert: {
          accepted?: boolean
          consent_type: string
          created_at?: string
          id?: string
          ip_address?: string | null
          user_agent?: string | null
          user_id: string
          version: string
        }
        Update: {
          accepted?: boolean
          consent_type?: string
          created_at?: string
          id?: string
          ip_address?: string | null
          user_agent?: string | null
          user_id?: string
          version?: string
        }
        Relationships: []
      }
      warehouses: {
        Row: {
          active: boolean
          address: string | null
          code: string
          created_at: string
          id: string
          is_default: boolean
          name: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          address?: string | null
          code: string
          created_at?: string
          id?: string
          is_default?: boolean
          name: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          address?: string | null
          code?: string
          created_at?: string
          id?: string
          is_default?: boolean
          name?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      customers_active: {
        Row: {
          created_at: string | null
          deleted_at: string | null
          document: string | null
          email: string | null
          id: string | null
          name: string | null
          notes: string | null
          phone: string | null
          tenant_id: string | null
        }
        Insert: {
          created_at?: string | null
          deleted_at?: string | null
          document?: string | null
          email?: string | null
          id?: string | null
          name?: string | null
          notes?: string | null
          phone?: string | null
          tenant_id?: string | null
        }
        Update: {
          created_at?: string | null
          deleted_at?: string | null
          document?: string | null
          email?: string | null
          id?: string | null
          name?: string | null
          notes?: string | null
          phone?: string | null
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customers_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      products_active: {
        Row: {
          active: boolean | null
          barcode: string | null
          category: string | null
          cest: string | null
          cfop: string | null
          cofins_aliquota: number | null
          controls_lot: boolean | null
          cost_price: number | null
          created_at: string | null
          csosn: string | null
          cst_icms: string | null
          deleted_at: string | null
          ean: string | null
          extra_attributes: Json | null
          icms_aliquota: number | null
          id: string | null
          internal_code: string | null
          min_stock: number | null
          name: string | null
          ncm: string | null
          origem: number | null
          pis_aliquota: number | null
          sale_price: number | null
          stock_current: number | null
          tenant_id: string | null
          unidade_medida: string | null
          unit: string | null
          updated_at: string | null
          weighted_avg_cost: number | null
          wholesale_min_qty: number | null
          wholesale_price: number | null
        }
        Insert: {
          active?: boolean | null
          barcode?: string | null
          category?: string | null
          cest?: string | null
          cfop?: string | null
          cofins_aliquota?: number | null
          controls_lot?: boolean | null
          cost_price?: number | null
          created_at?: string | null
          csosn?: string | null
          cst_icms?: string | null
          deleted_at?: string | null
          ean?: string | null
          extra_attributes?: Json | null
          icms_aliquota?: number | null
          id?: string | null
          internal_code?: string | null
          min_stock?: number | null
          name?: string | null
          ncm?: string | null
          origem?: number | null
          pis_aliquota?: number | null
          sale_price?: number | null
          stock_current?: number | null
          tenant_id?: string | null
          unidade_medida?: string | null
          unit?: string | null
          updated_at?: string | null
          weighted_avg_cost?: number | null
          wholesale_min_qty?: number | null
          wholesale_price?: number | null
        }
        Update: {
          active?: boolean | null
          barcode?: string | null
          category?: string | null
          cest?: string | null
          cfop?: string | null
          cofins_aliquota?: number | null
          controls_lot?: boolean | null
          cost_price?: number | null
          created_at?: string | null
          csosn?: string | null
          cst_icms?: string | null
          deleted_at?: string | null
          ean?: string | null
          extra_attributes?: Json | null
          icms_aliquota?: number | null
          id?: string | null
          internal_code?: string | null
          min_stock?: number | null
          name?: string | null
          ncm?: string | null
          origem?: number | null
          pis_aliquota?: number | null
          sale_price?: number | null
          stock_current?: number | null
          tenant_id?: string | null
          unidade_medida?: string | null
          unit?: string | null
          updated_at?: string | null
          weighted_avg_cost?: number | null
          wholesale_min_qty?: number | null
          wholesale_price?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "products_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      accept_invitation: { Args: { p_token: string }; Returns: string }
      adjust_stock: {
        Args: { p_delta: number; p_product_id: string; p_reason?: string }
        Returns: number
      }
      calculate_expected_balance: {
        Args: { p_session_id: string }
        Returns: number
      }
      cancel_fiscal_document: {
        Args: { p_id: string; p_reason?: string }
        Returns: {
          ambiente: string
          chave_acesso: string | null
          created_at: string
          created_by: string | null
          danfe_url: string | null
          document_type: string
          id: string
          numero_nota: number | null
          obs: string | null
          protocolo: string | null
          sale_id: string | null
          serie: string
          status: string
          tenant_id: string
          updated_at: string
          valor_impostos: number
          valor_total: number
          xml_content: string | null
        }
        SetofOptions: {
          from: "*"
          to: "fiscal_documents"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      consume_lots_fefo: {
        Args: { _product_id: string; _quantity: number; _tenant_id: string }
        Returns: Json
      }
      create_tenant_for_user: {
        Args: {
          p_document?: string
          p_name: string
          p_phone?: string
          p_segment?: string
        }
        Returns: {
          created_at: string | null
          document: string | null
          id: string
          name: string
          phone: string | null
          segment: string | null
          settings: Json | null
          subscription_expires_at: string | null
          subscription_status: string | null
        }
        SetofOptions: {
          from: "*"
          to: "tenants"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      credit_loyalty_points: {
        Args: {
          p_customer_id: string
          p_sale_amount: number
          p_sale_id: string
          p_tenant_id: string
        }
        Returns: number
      }
      decrement_stock:
        | {
            Args: { p_product_id: string; p_quantity: number }
            Returns: undefined
          }
        | {
            Args: {
              p_product_id: string
              p_quantity: number
              p_tenant_id?: string
            }
            Returns: undefined
          }
      export_my_data: { Args: never; Returns: Json }
      generate_fiscal_document: {
        Args: { p_document_type?: string; p_sale_id: string }
        Returns: {
          ambiente: string
          chave_acesso: string | null
          created_at: string
          created_by: string | null
          danfe_url: string | null
          document_type: string
          id: string
          numero_nota: number | null
          obs: string | null
          protocolo: string | null
          sale_id: string | null
          serie: string
          status: string
          tenant_id: string
          updated_at: string
          valor_impostos: number
          valor_total: number
          xml_content: string | null
        }
        SetofOptions: {
          from: "*"
          to: "fiscal_documents"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      generate_internal_barcode: {
        Args: { p_tenant_id: string }
        Returns: string
      }
      get_applicable_promotions: {
        Args: { p_product_id: string; p_tenant_id: string }
        Returns: {
          active: boolean
          category: string | null
          created_at: string
          created_by: string
          description: string | null
          discount_type: string
          discount_value: number
          ends_at: string | null
          id: string
          min_quantity: number | null
          name: string
          product_ids: string[] | null
          scope: string
          starts_at: string | null
          tenant_id: string
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "promotions"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_available_credit: { Args: { p_customer_id: string }; Returns: number }
      get_current_tenant_id: { Args: never; Returns: string }
      get_customer_points: { Args: { p_customer_id: string }; Returns: number }
      get_expiring_products: {
        Args: { p_days_ahead?: number; p_tenant_id: string }
        Returns: {
          days_until_expiry: number
          expiry_date: string
          lot_id: string
          lot_number: string
          product_id: string
          product_name: string
          quantity: number
          status: string
        }[]
      }
      get_financial_dashboard: {
        Args: { p_end: string; p_start: string; p_tenant_id: string }
        Returns: Json
      }
      get_invitation_info: {
        Args: { p_token: string }
        Returns: {
          email: string
          expires_at: string
          is_valid: boolean
          role: Database["public"]["Enums"]["app_role"]
          tenant_name: string
        }[]
      }
      get_session_payment_breakdown: {
        Args: { p_session_id: string }
        Returns: {
          expected: number
          payment_method: string
        }[]
      }
      get_tenant_members: {
        Args: { p_tenant_id: string }
        Returns: {
          created_at: string
          email: string
          last_seen: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }[]
      }
      get_user_tenants: { Args: never; Returns: string[] }
      has_tenant_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _tenant_id: string
        }
        Returns: boolean
      }
      increment_stock:
        | {
            Args: { p_product_id: string; p_quantity: number }
            Returns: undefined
          }
        | {
            Args: {
              p_product_id: string
              p_quantity: number
              p_tenant_id?: string
            }
            Returns: undefined
          }
      is_super_admin: { Args: { _user_id?: string }; Returns: boolean }
      list_employees_basic: {
        Args: { p_active_only?: boolean; p_tenant_id: string }
        Returns: {
          active: boolean
          department: string
          id: string
          name: string
          phone: string
          role: string
          tenant_id: string
        }[]
      }
      list_expiring_lots: {
        Args: { _days?: number }
        Returns: {
          days_left: number
          expiry_date: string
          lot_id: string
          lot_number: string
          product_id: string
          product_name: string
          quantity: number
        }[]
      }
      list_suppliers_basic: {
        Args: { p_tenant_id: string }
        Returns: {
          active: boolean
          category: string
          city: string
          document: string
          due_days: number
          email: string
          fantasy_name: string
          id: string
          name: string
          payment_terms: string
          phone: string
          state: string
          tenant_id: string
        }[]
      }
      log_audit_event: {
        Args: {
          p_action: string
          p_entity_id?: string
          p_entity_type: string
          p_new_data?: Json
          p_old_data?: Json
          p_tenant_id: string
        }
        Returns: string
      }
      pay_account: {
        Args: {
          p_account_id: string
          p_paid_amount: number
          p_paid_at: string
          p_payment_method: string
        }
        Returns: undefined
      }
      process_sale_return: {
        Args: {
          p_items: Json
          p_notes: string
          p_reason: string
          p_reason_type: string
          p_refund_method: string
          p_sale_id: string
        }
        Returns: string
      }
      receive_purchase_order_items:
        | { Args: { p_items: Json; p_order_id: string }; Returns: string }
        | {
            Args: { p_due_date?: string; p_items: Json; p_order_id: string }
            Returns: string
          }
      redeem_loyalty_points: {
        Args: {
          p_customer_id: string
          p_description?: string
          p_points: number
          p_tenant_id: string
        }
        Returns: number
      }
      seed_default_payment_methods: {
        Args: { p_tenant_id: string }
        Returns: undefined
      }
      soft_delete_product: { Args: { _product_id: string }; Returns: undefined }
      super_create_tenant_with_admin: {
        Args: {
          p_admin_email: string
          p_document: string
          p_name: string
          p_phone: string
          p_segment: string
        }
        Returns: Json
      }
      super_get_metrics: { Args: never; Returns: Json }
      super_list_tenants: {
        Args: never
        Returns: {
          created_at: string
          document: string
          id: string
          name: string
          phone: string
          revenue_30d: number
          sales_count: number
          segment: string
          user_count: number
        }[]
      }
      transfer_stock: {
        Args: {
          _from_warehouse: string
          _notes?: string
          _product_id: string
          _quantity: number
          _to_warehouse: string
        }
        Returns: string
      }
      update_weighted_avg_cost: {
        Args: {
          p_incoming_cost: number
          p_incoming_qty: number
          p_product_id: string
        }
        Returns: number
      }
      user_belongs_to_tenant: { Args: { _tenant_id: string }; Returns: boolean }
      validate_ean: { Args: { barcode: string }; Returns: boolean }
      write_off_expired_lot: {
        Args: { _lot_id: string; _reason?: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role:
        | "admin"
        | "operator"
        | "manager"
        | "cashier"
        | "financial"
        | "stock"
      system_role: "super_admin" | "user"
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
      app_role: [
        "admin",
        "operator",
        "manager",
        "cashier",
        "financial",
        "stock",
      ],
      system_role: ["super_admin", "user"],
    },
  },
} as const
