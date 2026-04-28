// =============================================
// 상태값 Union 타입
// =============================================

export type MemberGrade = "NORMAL" | "SILVER" | "GOLD" | "VIP"

export type ProductStatus = "ACTIVE" | "SOLDOUT" | "HIDDEN" | "DELETED"

export type OrderStatus =
  | "PENDING"
  | "PAID"
  | "PREPARING"
  | "SHIPPING"
  | "DELIVERED"
  | "CONFIRMED"
  | "CANCELLED"
  | "RETURN_REQUESTED"
  | "RETURNED"
  | "EXCHANGE_REQUESTED"
  | "EXCHANGED"

export type PaymentMethod =
  | "CARD"
  | "TRANSFER"
  | "VIRTUAL_ACCOUNT"
  | "KAKAOPAY"
  | "NAVERPAY"
  | "TOSSPAY"

export type PaymentStatus =
  | "READY"
  | "DONE"
  | "CANCELLED"
  | "PARTIAL_CANCELLED"
  | "ABORTED"
  | "EXPIRED"

export type CouponType = "FIXED" | "PERCENT"

export type SyncType = "IMPORT" | "EXPORT" | "STOCK_SYNC"
export type SyncStatus = "SUCCESS" | "PARTIAL" | "FAILED"

// =============================================
// Row 타입 (테이블 기본)
// =============================================

export interface Profile {
  id: string
  email: string
  name: string | null
  phone: string | null
  height: number | null
  weight: number | null
  marketing_agreed: boolean
  grade: MemberGrade
  point: number
  created_at: string
  updated_at: string
}

export interface Address {
  id: string
  user_id: string
  label: string
  recipient: string
  phone: string
  zipcode: string
  address1: string
  address2: string | null
  is_default: boolean
  created_at: string
}

export interface Category {
  id: string
  parent_id: string | null
  name: string
  slug: string
  sort_order: number
  created_at: string
}

export interface Product {
  id: string
  category_id: string | null
  name: string
  slug: string | null
  description: string | null
  price: number
  sale_price: number | null
  status: ProductStatus
  material: string | null
  care_info: string | null
  origin: string | null
  free_shipping: boolean
  naver_product_no: string | null
  view_count: number
  sell_count: number
  created_at: string
  updated_at: string
}

export interface ProductImage {
  id: string
  product_id: string
  url: string
  is_thumbnail: boolean
  sort_order: number
  created_at: string
}

export interface ProductOption {
  id: string
  product_id: string
  color: string
  size: string
  stock: number
  extra_price: number
  sku: string | null
  naver_option_id: string | null
  created_at: string
}

export interface Order {
  id: string
  user_id: string
  order_no: string
  status: OrderStatus
  total_amount: number
  discount_amount: number
  point_used: number
  shipping_fee: number
  paid_amount: number
  recipient: string
  recipient_phone: string
  zipcode: string
  address1: string
  address2: string | null
  delivery_memo: string | null
  courier: string | null
  tracking_no: string | null
  created_at: string
  updated_at: string
}

export interface OrderItem {
  id: string
  order_id: string
  product_id: string | null
  product_option_id: string | null
  product_name: string
  product_image: string | null
  color: string
  size: string
  price: number
  quantity: number
  is_reviewed: boolean
  created_at: string
}

export interface Payment {
  id: string
  order_id: string
  payment_key: string | null
  method: PaymentMethod | null
  amount: number
  status: PaymentStatus
  raw_response: Record<string, unknown> | null
  approved_at: string | null
  created_at: string
}

export interface Coupon {
  id: string
  name: string
  code: string
  type: CouponType
  value: number
  min_order_price: number
  max_discount: number | null
  starts_at: string
  expires_at: string | null
  total_quantity: number | null
  issued_count: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface UserCoupon {
  id: string
  user_id: string
  coupon_id: string
  used_at: string | null
  order_id: string | null
  created_at: string
}

export interface PointHistory {
  id: string
  user_id: string
  amount: number
  reason: string
  order_id: string | null
  created_at: string
}

export type ReviewTagSize = "약간 작아요" | "딱 맞아요" | "약간 커요"
export type ReviewTagColor = "화면보다 어두워요" | "화면과 똑같아요" | "화면보다 밝아요"
export type ReviewTagThickness = "얇아요" | "적당해요" | "두꺼워요"
export type ReviewTagStretch = "없어요" | "적당해요" | "많이 있어요"

export interface Review {
  id: string
  user_id: string
  product_id: string
  order_item_id: string | null
  rating: number
  content: string | null
  height: number | null
  weight: number | null
  purchased_size: string | null
  tag_size: ReviewTagSize | null
  tag_color: ReviewTagColor | null
  tag_thickness: ReviewTagThickness | null
  tag_stretch: ReviewTagStretch | null
  helpful_count: number
  created_at: string
}

export interface ReviewImage {
  id: string
  review_id: string
  url: string
  sort_order: number
  created_at: string
}

export interface NaverSyncLog {
  id: string
  sync_type: SyncType
  status: SyncStatus
  total_count: number
  success_count: number
  fail_count: number
  error_details: Record<string, unknown> | null
  created_at: string
}

// =============================================
// JOIN 결과 타입
// =============================================

export interface ProductWithDetails extends Product {
  category: Category | null
  images: ProductImage[]
  options: ProductOption[]
}

export interface OrderWithItems extends Order {
  items: OrderItem[]
  payment: Payment | null
}

export interface ReviewWithImages extends Review {
  images: ReviewImage[]
  user: Pick<Profile, "name" | "height" | "weight"> | null
}

export interface CategoryWithChildren extends Category {
  children: Category[]
}

export interface UserCouponWithDetails extends UserCoupon {
  coupon: Coupon
}

// =============================================
// 클라이언트 장바구니
// =============================================

export interface CartItem {
  id?: string
  product_id: string
  product_option_id: string
  product_name: string
  product_image: string | null
  color: string
  size: string
  price: number
  extra_price: number
  quantity: number
  stock: number
  soldout?: boolean
  free_shipping?: boolean
}
