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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      addresses: {
        Row: {
          address1: string
          address2: string | null
          created_at: string | null
          id: string
          is_default: boolean | null
          label: string
          phone: string
          recipient: string
          user_id: string
          zipcode: string
        }
        Insert: {
          address1: string
          address2?: string | null
          created_at?: string | null
          id?: string
          is_default?: boolean | null
          label?: string
          phone: string
          recipient: string
          user_id: string
          zipcode: string
        }
        Update: {
          address1?: string
          address2?: string | null
          created_at?: string | null
          id?: string
          is_default?: boolean | null
          label?: string
          phone?: string
          recipient?: string
          user_id?: string
          zipcode?: string
        }
        Relationships: [
          {
            foreignKeyName: "addresses_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      cart_items: {
        Row: {
          created_at: string | null
          id: string
          product_option_id: string
          quantity: number
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          product_option_id: string
          quantity?: number
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          product_option_id?: string
          quantity?: number
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cart_items_product_option_id_fkey"
            columns: ["product_option_id"]
            isOneToOne: false
            referencedRelation: "product_options"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cart_items_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          created_at: string | null
          id: string
          name: string
          parent_id: string | null
          slug: string
          sort_order: number | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          parent_id?: string | null
          slug: string
          sort_order?: number | null
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          parent_id?: string | null
          slug?: string
          sort_order?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      coupons: {
        Row: {
          code: string
          created_at: string | null
          expires_at: string | null
          id: string
          is_active: boolean | null
          issued_count: number | null
          max_discount: number | null
          min_order_price: number | null
          name: string
          starts_at: string
          total_quantity: number | null
          type: string
          updated_at: string | null
          value: number
        }
        Insert: {
          code: string
          created_at?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          issued_count?: number | null
          max_discount?: number | null
          min_order_price?: number | null
          name: string
          starts_at?: string
          total_quantity?: number | null
          type: string
          updated_at?: string | null
          value: number
        }
        Update: {
          code?: string
          created_at?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          issued_count?: number | null
          max_discount?: number | null
          min_order_price?: number | null
          name?: string
          starts_at?: string
          total_quantity?: number | null
          type?: string
          updated_at?: string | null
          value?: number
        }
        Relationships: []
      }
      event_categories: {
        Row: {
          color: string
          created_at: string
          display_order: number
          emoji: string | null
          ends_at: string | null
          id: string
          is_active: boolean
          link_url: string | null
          name: string
          starts_at: string | null
          updated_at: string
        }
        Insert: {
          color?: string
          created_at?: string
          display_order?: number
          emoji?: string | null
          ends_at?: string | null
          id?: string
          is_active?: boolean
          link_url?: string | null
          name: string
          starts_at?: string | null
          updated_at?: string
        }
        Update: {
          color?: string
          created_at?: string
          display_order?: number
          emoji?: string | null
          ends_at?: string | null
          id?: string
          is_active?: boolean
          link_url?: string | null
          name?: string
          starts_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      event_category_products: {
        Row: {
          created_at: string
          display_order: number
          event_category_id: string
          product_id: string
        }
        Insert: {
          created_at?: string
          display_order?: number
          event_category_id: string
          product_id: string
        }
        Update: {
          created_at?: string
          display_order?: number
          event_category_id?: string
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_category_products_event_category_id_fkey"
            columns: ["event_category_id"]
            isOneToOne: false
            referencedRelation: "event_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_category_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      hero_banners: {
        Row: {
          created_at: string
          cta_link: string | null
          cta_text: string | null
          ends_at: string | null
          id: string
          image_url_mobile: string
          image_url_pc: string
          is_active: boolean
          sort_order: number
          starts_at: string | null
          subtitle: string | null
          title: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          cta_link?: string | null
          cta_text?: string | null
          ends_at?: string | null
          id?: string
          image_url_mobile: string
          image_url_pc: string
          is_active?: boolean
          sort_order?: number
          starts_at?: string | null
          subtitle?: string | null
          title?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          cta_link?: string | null
          cta_text?: string | null
          ends_at?: string | null
          id?: string
          image_url_mobile?: string
          image_url_pc?: string
          is_active?: boolean
          sort_order?: number
          starts_at?: string | null
          subtitle?: string | null
          title?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      naver_category_mappings: {
        Row: {
          category_id: string | null
          created_at: string | null
          id: string
          naver_category_id: string
          naver_category_name: string | null
        }
        Insert: {
          category_id?: string | null
          created_at?: string | null
          id?: string
          naver_category_id: string
          naver_category_name?: string | null
        }
        Update: {
          category_id?: string | null
          created_at?: string | null
          id?: string
          naver_category_id?: string
          naver_category_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "naver_category_mappings_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      naver_sync_logs: {
        Row: {
          created_at: string | null
          error_details: Json | null
          fail_count: number | null
          id: string
          status: string
          success_count: number | null
          sync_type: string
          total_count: number | null
        }
        Insert: {
          created_at?: string | null
          error_details?: Json | null
          fail_count?: number | null
          id?: string
          status: string
          success_count?: number | null
          sync_type: string
          total_count?: number | null
        }
        Update: {
          created_at?: string | null
          error_details?: Json | null
          fail_count?: number | null
          id?: string
          status?: string
          success_count?: number | null
          sync_type?: string
          total_count?: number | null
        }
        Relationships: []
      }
      order_claims: {
        Row: {
          approved_at: string | null
          collected_at: string | null
          completed_at: string | null
          confirmed_deduction: number | null
          created_at: string
          exchange_to_option_id: string | null
          id: string
          order_id: string
          prev_order_status: string
          processed_by: string | null
          proposed_deduction: number
          reason_category: string
          reason_detail: string | null
          refund_amount: number | null
          rejected_reason: string | null
          requested_at: string
          reship_courier: string | null
          reship_tracking_number: string | null
          status: string
          toss_cancel_idempotency_key: string | null
          toss_cancel_response: Json | null
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          approved_at?: string | null
          collected_at?: string | null
          completed_at?: string | null
          confirmed_deduction?: number | null
          created_at?: string
          exchange_to_option_id?: string | null
          id?: string
          order_id: string
          prev_order_status: string
          processed_by?: string | null
          proposed_deduction?: number
          reason_category: string
          reason_detail?: string | null
          refund_amount?: number | null
          rejected_reason?: string | null
          requested_at?: string
          reship_courier?: string | null
          reship_tracking_number?: string | null
          status?: string
          toss_cancel_idempotency_key?: string | null
          toss_cancel_response?: Json | null
          type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          approved_at?: string | null
          collected_at?: string | null
          completed_at?: string | null
          confirmed_deduction?: number | null
          created_at?: string
          exchange_to_option_id?: string | null
          id?: string
          order_id?: string
          prev_order_status?: string
          processed_by?: string | null
          proposed_deduction?: number
          reason_category?: string
          reason_detail?: string | null
          refund_amount?: number | null
          rejected_reason?: string | null
          requested_at?: string
          reship_courier?: string | null
          reship_tracking_number?: string | null
          status?: string
          toss_cancel_idempotency_key?: string | null
          toss_cancel_response?: Json | null
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_claims_exchange_to_option_id_fkey"
            columns: ["exchange_to_option_id"]
            isOneToOne: false
            referencedRelation: "product_options"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_claims_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_claims_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "visible_user_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_claims_processed_by_fkey"
            columns: ["processed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_claims_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          color: string
          created_at: string | null
          id: string
          is_reviewed: boolean | null
          order_id: string
          price: number
          product_id: string | null
          product_image: string | null
          product_name: string
          product_option_id: string | null
          quantity: number
          size: string
        }
        Insert: {
          color: string
          created_at?: string | null
          id?: string
          is_reviewed?: boolean | null
          order_id: string
          price: number
          product_id?: string | null
          product_image?: string | null
          product_name: string
          product_option_id?: string | null
          quantity: number
          size: string
        }
        Update: {
          color?: string
          created_at?: string | null
          id?: string
          is_reviewed?: boolean | null
          order_id?: string
          price?: number
          product_id?: string | null
          product_image?: string | null
          product_name?: string
          product_option_id?: string | null
          quantity?: number
          size?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "visible_user_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_option_id_fkey"
            columns: ["product_option_id"]
            isOneToOne: false
            referencedRelation: "product_options"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          address1: string
          address2: string | null
          cancellation_actor: string | null
          cancellation_note: string | null
          cancellation_reason: string | null
          coupon_id: string | null
          courier: string | null
          created_at: string | null
          delivered_at: string | null
          delivered_via: string | null
          delivery_memo: string | null
          discount_amount: number | null
          id: string
          order_no: string
          paid_amount: number
          point_used: number | null
          recipient: string
          recipient_phone: string
          shipped_at: string | null
          shipping_fee: number | null
          status: string | null
          total_amount: number
          tracking_no: string | null
          updated_at: string | null
          user_id: string
          zipcode: string
        }
        Insert: {
          address1: string
          address2?: string | null
          cancellation_actor?: string | null
          cancellation_note?: string | null
          cancellation_reason?: string | null
          coupon_id?: string | null
          courier?: string | null
          created_at?: string | null
          delivered_at?: string | null
          delivered_via?: string | null
          delivery_memo?: string | null
          discount_amount?: number | null
          id?: string
          order_no: string
          paid_amount: number
          point_used?: number | null
          recipient: string
          recipient_phone: string
          shipped_at?: string | null
          shipping_fee?: number | null
          status?: string | null
          total_amount: number
          tracking_no?: string | null
          updated_at?: string | null
          user_id: string
          zipcode: string
        }
        Update: {
          address1?: string
          address2?: string | null
          cancellation_actor?: string | null
          cancellation_note?: string | null
          cancellation_reason?: string | null
          coupon_id?: string | null
          courier?: string | null
          created_at?: string | null
          delivered_at?: string | null
          delivered_via?: string | null
          delivery_memo?: string | null
          discount_amount?: number | null
          id?: string
          order_no?: string
          paid_amount?: number
          point_used?: number | null
          recipient?: string
          recipient_phone?: string
          shipped_at?: string | null
          shipping_fee?: number | null
          status?: string | null
          total_amount?: number
          tracking_no?: string | null
          updated_at?: string | null
          user_id?: string
          zipcode?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_coupon_id_fkey"
            columns: ["coupon_id"]
            isOneToOne: false
            referencedRelation: "coupons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          approved_at: string | null
          created_at: string | null
          id: string
          method: string | null
          order_id: string
          payment_key: string | null
          raw_response: Json | null
          secret: string | null
          status: string | null
        }
        Insert: {
          amount: number
          approved_at?: string | null
          created_at?: string | null
          id?: string
          method?: string | null
          order_id: string
          payment_key?: string | null
          raw_response?: Json | null
          secret?: string | null
          status?: string | null
        }
        Update: {
          amount?: number
          approved_at?: string | null
          created_at?: string | null
          id?: string
          method?: string | null
          order_id?: string
          payment_key?: string | null
          raw_response?: Json | null
          secret?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "visible_user_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      point_histories: {
        Row: {
          amount: number
          created_at: string | null
          id: string
          order_id: string | null
          reason: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string | null
          id?: string
          order_id?: string | null
          reason: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string | null
          id?: string
          order_id?: string | null
          reason?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "point_histories_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "point_histories_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "visible_user_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "point_histories_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      product_images: {
        Row: {
          alt_text: string | null
          created_at: string | null
          id: string
          is_thumbnail: boolean | null
          product_id: string
          sort_order: number | null
          url: string
        }
        Insert: {
          alt_text?: string | null
          created_at?: string | null
          id?: string
          is_thumbnail?: boolean | null
          product_id: string
          sort_order?: number | null
          url: string
        }
        Update: {
          alt_text?: string | null
          created_at?: string | null
          id?: string
          is_thumbnail?: boolean | null
          product_id?: string
          sort_order?: number | null
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_images_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_options: {
        Row: {
          color: string
          created_at: string | null
          extra_price: number | null
          id: string
          naver_option_id: string | null
          product_id: string
          size: string
          sku: string | null
          stock: number | null
        }
        Insert: {
          color: string
          created_at?: string | null
          extra_price?: number | null
          id?: string
          naver_option_id?: string | null
          product_id: string
          size: string
          sku?: string | null
          stock?: number | null
        }
        Update: {
          color?: string
          created_at?: string | null
          extra_price?: number | null
          id?: string
          naver_option_id?: string | null
          product_id?: string
          size?: string
          sku?: string | null
          stock?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "product_options_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          care_info: string | null
          category_id: string | null
          created_at: string | null
          description: string | null
          fit_type: string | null
          free_shipping: boolean
          id: string
          material: string | null
          meta_description: string | null
          meta_title: string | null
          name: string
          naver_product_no: string | null
          origin: string | null
          price: number
          sale_price: number | null
          search_tags: string[] | null
          sell_count: number | null
          seo_updated_at: string | null
          slug: string
          status: string | null
          updated_at: string | null
          view_count: number | null
        }
        Insert: {
          care_info?: string | null
          category_id?: string | null
          created_at?: string | null
          description?: string | null
          fit_type?: string | null
          free_shipping?: boolean
          id?: string
          material?: string | null
          meta_description?: string | null
          meta_title?: string | null
          name: string
          naver_product_no?: string | null
          origin?: string | null
          price: number
          sale_price?: number | null
          search_tags?: string[] | null
          sell_count?: number | null
          seo_updated_at?: string | null
          slug: string
          status?: string | null
          updated_at?: string | null
          view_count?: number | null
        }
        Update: {
          care_info?: string | null
          category_id?: string | null
          created_at?: string | null
          description?: string | null
          fit_type?: string | null
          free_shipping?: boolean
          id?: string
          material?: string | null
          meta_description?: string | null
          meta_title?: string | null
          name?: string
          naver_product_no?: string | null
          origin?: string | null
          price?: number
          sale_price?: number | null
          search_tags?: string[] | null
          sell_count?: number | null
          seo_updated_at?: string | null
          slug?: string
          status?: string | null
          updated_at?: string | null
          view_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string | null
          email: string
          grade: string | null
          height: number | null
          id: string
          marketing_agreed: boolean | null
          name: string | null
          phone: string | null
          point: number | null
          updated_at: string | null
          weight: number | null
        }
        Insert: {
          created_at?: string | null
          email: string
          grade?: string | null
          height?: number | null
          id: string
          marketing_agreed?: boolean | null
          name?: string | null
          phone?: string | null
          point?: number | null
          updated_at?: string | null
          weight?: number | null
        }
        Update: {
          created_at?: string | null
          email?: string
          grade?: string | null
          height?: number | null
          id?: string
          marketing_agreed?: boolean | null
          name?: string | null
          phone?: string | null
          point?: number | null
          updated_at?: string | null
          weight?: number | null
        }
        Relationships: []
      }
      review_images: {
        Row: {
          created_at: string | null
          id: string
          review_id: string
          sort_order: number | null
          url: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          review_id: string
          sort_order?: number | null
          url: string
        }
        Update: {
          created_at?: string | null
          id?: string
          review_id?: string
          sort_order?: number | null
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "review_images_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "reviews"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          content: string | null
          created_at: string | null
          height: number | null
          helpful_count: number | null
          id: string
          order_item_id: string | null
          product_id: string
          purchased_size: string | null
          rating: number
          tag_color: string | null
          tag_size: string | null
          tag_stretch: string | null
          tag_thickness: string | null
          user_id: string
          weight: number | null
        }
        Insert: {
          content?: string | null
          created_at?: string | null
          height?: number | null
          helpful_count?: number | null
          id?: string
          order_item_id?: string | null
          product_id: string
          purchased_size?: string | null
          rating: number
          tag_color?: string | null
          tag_size?: string | null
          tag_stretch?: string | null
          tag_thickness?: string | null
          user_id: string
          weight?: number | null
        }
        Update: {
          content?: string | null
          created_at?: string | null
          height?: number | null
          helpful_count?: number | null
          id?: string
          order_item_id?: string | null
          product_id?: string
          purchased_size?: string | null
          rating?: number
          tag_color?: string | null
          tag_size?: string | null
          tag_stretch?: string | null
          tag_thickness?: string | null
          user_id?: string
          weight?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "reviews_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "order_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      seo_generation_queue: {
        Row: {
          completed_at: string | null
          created_at: string
          description_mode: string
          error_message: string | null
          failed_at: string | null
          id: string
          last_error: string | null
          product_id: string
          retry_count: number
          scheduled_at: string
          started_at: string | null
          status: string
          trigger_source: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          description_mode?: string
          error_message?: string | null
          failed_at?: string | null
          id?: string
          last_error?: string | null
          product_id: string
          retry_count?: number
          scheduled_at?: string
          started_at?: string | null
          status: string
          trigger_source: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          description_mode?: string
          error_message?: string | null
          failed_at?: string | null
          id?: string
          last_error?: string | null
          product_id?: string
          retry_count?: number
          scheduled_at?: string
          started_at?: string | null
          status?: string
          trigger_source?: string
        }
        Relationships: [
          {
            foreignKeyName: "seo_generation_queue_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      seo_metadata_drafts: {
        Row: {
          category_hint: string | null
          cost_usd: number | null
          created_at: string
          description_mode: string
          error_message: string | null
          id: string
          image_alt_texts: Json | null
          image_count: number | null
          meta_description: string | null
          meta_title: string | null
          model: string
          product_description: string | null
          product_id: string
          prompt_version: string
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          search_tags: string[] | null
          spec_metadata: Json | null
          status: string
          tokens_input: number | null
          tokens_output: number | null
          updated_at: string
        }
        Insert: {
          category_hint?: string | null
          cost_usd?: number | null
          created_at?: string
          description_mode?: string
          error_message?: string | null
          id?: string
          image_alt_texts?: Json | null
          image_count?: number | null
          meta_description?: string | null
          meta_title?: string | null
          model: string
          product_description?: string | null
          product_id: string
          prompt_version: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          search_tags?: string[] | null
          spec_metadata?: Json | null
          status: string
          tokens_input?: number | null
          tokens_output?: number | null
          updated_at?: string
        }
        Update: {
          category_hint?: string | null
          cost_usd?: number | null
          created_at?: string
          description_mode?: string
          error_message?: string | null
          id?: string
          image_alt_texts?: Json | null
          image_count?: number | null
          meta_description?: string | null
          meta_title?: string | null
          model?: string
          product_description?: string | null
          product_id?: string
          prompt_version?: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          search_tags?: string[] | null
          spec_metadata?: Json | null
          status?: string
          tokens_input?: number | null
          tokens_output?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "seo_metadata_drafts_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      slack_command_log: {
        Row: {
          channel_id: string
          command_text: string | null
          created_at: string
          message_ts: string
          processed_at: string | null
          result: string | null
          status: string
          user_id: string
        }
        Insert: {
          channel_id: string
          command_text?: string | null
          created_at?: string
          message_ts: string
          processed_at?: string | null
          result?: string | null
          status?: string
          user_id: string
        }
        Update: {
          channel_id?: string
          command_text?: string | null
          created_at?: string
          message_ts?: string
          processed_at?: string | null
          result?: string | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      top_banners: {
        Row: {
          bg_color: string | null
          created_at: string
          emoji: string | null
          ends_at: string | null
          id: string
          is_active: boolean
          link_url: string | null
          message: string
          sort_order: number
          starts_at: string | null
          text_color: string | null
          updated_at: string
          variant: string
        }
        Insert: {
          bg_color?: string | null
          created_at?: string
          emoji?: string | null
          ends_at?: string | null
          id?: string
          is_active?: boolean
          link_url?: string | null
          message: string
          sort_order?: number
          starts_at?: string | null
          text_color?: string | null
          updated_at?: string
          variant?: string
        }
        Update: {
          bg_color?: string | null
          created_at?: string
          emoji?: string | null
          ends_at?: string | null
          id?: string
          is_active?: boolean
          link_url?: string | null
          message?: string
          sort_order?: number
          starts_at?: string | null
          text_color?: string | null
          updated_at?: string
          variant?: string
        }
        Relationships: []
      }
      user_coupons: {
        Row: {
          coupon_id: string
          created_at: string | null
          id: string
          order_id: string | null
          used_at: string | null
          user_id: string
        }
        Insert: {
          coupon_id: string
          created_at?: string | null
          id?: string
          order_id?: string | null
          used_at?: string | null
          user_id: string
        }
        Update: {
          coupon_id?: string
          created_at?: string | null
          id?: string
          order_id?: string | null
          used_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_coupons_coupon_id_fkey"
            columns: ["coupon_id"]
            isOneToOne: false
            referencedRelation: "coupons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_coupons_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_coupons_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "visible_user_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_coupons_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      visible_user_orders: {
        Row: {
          address1: string | null
          address2: string | null
          coupon_id: string | null
          courier: string | null
          created_at: string | null
          delivery_memo: string | null
          discount_amount: number | null
          id: string | null
          order_no: string | null
          paid_amount: number | null
          point_used: number | null
          recipient: string | null
          recipient_phone: string | null
          shipping_fee: number | null
          status: string | null
          total_amount: number | null
          tracking_no: string | null
          updated_at: string | null
          user_id: string | null
          zipcode: string | null
        }
        Insert: {
          address1?: string | null
          address2?: string | null
          coupon_id?: string | null
          courier?: string | null
          created_at?: string | null
          delivery_memo?: string | null
          discount_amount?: number | null
          id?: string | null
          order_no?: string | null
          paid_amount?: number | null
          point_used?: number | null
          recipient?: string | null
          recipient_phone?: string | null
          shipping_fee?: number | null
          status?: string | null
          total_amount?: number | null
          tracking_no?: string | null
          updated_at?: string | null
          user_id?: string | null
          zipcode?: string | null
        }
        Update: {
          address1?: string | null
          address2?: string | null
          coupon_id?: string | null
          courier?: string | null
          created_at?: string | null
          delivery_memo?: string | null
          discount_amount?: number | null
          id?: string | null
          order_no?: string | null
          paid_amount?: number | null
          point_used?: number | null
          recipient?: string | null
          recipient_phone?: string | null
          shipping_fee?: number | null
          status?: string | null
          total_amount?: number | null
          tracking_no?: string | null
          updated_at?: string | null
          user_id?: string | null
          zipcode?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_coupon_id_fkey"
            columns: ["coupon_id"]
            isOneToOne: false
            referencedRelation: "coupons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      add_member_point: {
        Args: { p_amount: number; p_reason: string; p_user_id: string }
        Returns: Json
      }
      approve_seo_draft: {
        Args: {
          p_draft_id: string
          p_pattern_alts: Json
          p_processed_description: string
          p_review_note?: string
          p_reviewer_id: string
        }
        Returns: undefined
      }
      create_order_with_items: {
        Args: {
          p_address: Json
          p_coupon_id?: string
          p_free_shipping_threshold: number
          p_items: Json
          p_point_used?: number
          p_standard_shipping_fee: number
          p_user_id: string
        }
        Returns: Json
      }
      expire_pending_orders: { Args: never; Returns: number }
      get_product_review_tag_summary: {
        Args: { p_product_id: string }
        Returns: {
          axis: string
          count: number
          option: string
          percentage: number
        }[]
      }
      process_exchange_reship: {
        Args: { p_claim_id: string; p_courier: string; p_tracking: string }
        Returns: undefined
      }
      process_return_refund: {
        Args: {
          p_claim_id: string
          p_processed_by: string
          p_refund_amount: number
        }
        Returns: undefined
      }
      restore_stock: {
        Args: { p_option_id: string; p_quantity: number }
        Returns: undefined
      }
      seo_monthly_cost_usd: { Args: never; Returns: number }
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
