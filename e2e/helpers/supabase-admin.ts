import { createClient } from "@supabase/supabase-js"
import * as dotenv from "dotenv"
import path from "path"

// .env.local 로드 (Supabase 환경변수)
dotenv.config({ path: path.resolve(__dirname, "../../.env.local") })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export const adminClient = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})

// --- 테스트 유저 ---

export const ensureTestUser = async (
  email: string,
  password: string,
  name: string
) => {
  // 기존 유저 확인
  const { data: existingUsers } = await adminClient.auth.admin.listUsers()
  const existing = existingUsers?.users?.find((u) => u.email === email)

  if (existing) return existing

  const { data, error } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name },
  })

  if (error) throw new Error(`Failed to create user ${email}: ${error.message}`)
  return data.user
}

export const deleteTestUser = async (email: string) => {
  const { data: users } = await adminClient.auth.admin.listUsers()
  const user = users?.users?.find((u) => u.email === email)
  if (user) {
    await adminClient.auth.admin.deleteUser(user.id)
  }
}

// --- 테스트 상품 ---

export const createTestProduct = async (opts: {
  name: string
  price: number
  salePrice?: number
  categoryId?: string
  options?: Array<{
    color: string
    size: string
    stock: number
    extraPrice?: number
  }>
}) => {
  const { data: product, error: prodErr } = await adminClient
    .from("products")
    .insert({
      name: opts.name,
      price: opts.price,
      sale_price: opts.salePrice ?? null,
      category_id: opts.categoryId ?? null,
      status: "ACTIVE",
      description: "E2E 테스트 상품입니다",
    })
    .select()
    .single()

  if (prodErr) throw new Error(`Failed to create product: ${prodErr.message}`)

  if (opts.options?.length) {
    const optionRows = opts.options.map((o) => ({
      product_id: product.id,
      color: o.color,
      size: o.size,
      stock: o.stock,
      extra_price: o.extraPrice ?? 0,
    }))

    const { error: optErr } = await adminClient
      .from("product_options")
      .insert(optionRows)

    if (optErr) throw new Error(`Failed to create options: ${optErr.message}`)
  }

  return product
}

// --- 테스트 주문 ---

export const createTestOrder = async (opts: {
  userId: string
  productName: string
  totalAmount: number
  paidAmount: number
  status?: string
  items: Array<{
    productId: string
    productOptionId?: string
    productName: string
    color: string
    size: string
    price: number
    quantity: number
  }>
}) => {
  const orderNo = `E2E-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`

  const { data: order, error: orderErr } = await adminClient
    .from("orders")
    .insert({
      user_id: opts.userId,
      order_no: orderNo,
      status: opts.status ?? "PAID",
      total_amount: opts.totalAmount,
      discount_amount: 0,
      point_used: 0,
      shipping_fee: opts.totalAmount >= 50000 ? 0 : 3000,
      paid_amount: opts.paidAmount,
      recipient: "E2E테스트수령인",
      recipient_phone: "01012345678",
      zipcode: "06234",
      address1: "서울 강남구 테헤란로 123",
      address2: "테스트동 101호",
    })
    .select()
    .single()

  if (orderErr) throw new Error(`Failed to create order: ${orderErr.message}`)

  const itemRows = opts.items.map((item) => ({
    order_id: order.id,
    product_id: item.productId,
    product_option_id: item.productOptionId ?? null,
    product_name: item.productName,
    color: item.color,
    size: item.size,
    price: item.price,
    quantity: item.quantity,
  }))

  const { error: itemErr } = await adminClient
    .from("order_items")
    .insert(itemRows)

  if (itemErr) throw new Error(`Failed to create order items: ${itemErr.message}`)

  return order
}

// --- 테스트 쿠폰 ---

export const createTestCoupon = async (opts: {
  name: string
  code: string
  type: "FIXED" | "PERCENT"
  discountValue: number
  minOrderAmount: number
  maxDiscount?: number
}) => {
  const now = new Date()
  const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000) // 30일 후

  const { data, error } = await adminClient
    .from("coupons")
    .insert({
      name: opts.name,
      code: opts.code,
      type: opts.type,
      discount_value: opts.discountValue,
      min_order_amount: opts.minOrderAmount,
      max_discount: opts.maxDiscount ?? null,
      starts_at: now.toISOString(),
      expires_at: expiresAt.toISOString(),
      max_issues: 0,
      is_active: true,
    })
    .select()
    .single()

  if (error) throw new Error(`Failed to create coupon: ${error.message}`)
  return data
}

export const issueCouponToUser = async (userId: string, couponId: string) => {
  const { error } = await adminClient.from("user_coupons").insert({
    user_id: userId,
    coupon_id: couponId,
  })

  if (error) throw new Error(`Failed to issue coupon: ${error.message}`)
}

// --- 포인트 ---

export const setUserPoint = async (userId: string, amount: number) => {
  const { error: profileErr } = await adminClient
    .from("profiles")
    .update({ point: amount })
    .eq("id", userId)

  if (profileErr) throw new Error(`Failed to set point: ${profileErr.message}`)

  await adminClient.from("point_histories").insert({
    user_id: userId,
    amount,
    reason: "E2E 테스트 포인트 지급",
  })
}

// --- Cleanup ---

export const cleanupByPrefix = async (prefix: string) => {
  // 상품 삭제 (관련 옵션은 cascade 또는 수동)
  const { data: products } = await adminClient
    .from("products")
    .select("id")
    .like("name", `${prefix}%`)

  if (products?.length) {
    const productIds = products.map((p) => p.id)
    await adminClient
      .from("product_options")
      .delete()
      .in("product_id", productIds)
    await adminClient
      .from("product_images")
      .delete()
      .in("product_id", productIds)
    await adminClient.from("products").delete().in("id", productIds)
  }

  // 쿠폰 삭제
  const { data: coupons } = await adminClient
    .from("coupons")
    .select("id")
    .like("name", `${prefix}%`)

  if (coupons?.length) {
    const couponIds = coupons.map((c) => c.id)
    await adminClient.from("user_coupons").delete().in("coupon_id", couponIds)
    await adminClient.from("coupons").delete().in("id", couponIds)
  }
}

export const cleanupAllE2E = async () => {
  const prefixes = [
    "[E2E-auth]",
    "[E2E-order]",
    "[E2E-admin-prod]",
    "[E2E-admin-order]",
    "[E2E-coupon]",
  ]
  for (const prefix of prefixes) {
    await cleanupByPrefix(prefix)
  }

  // E2E 주문 삭제 (order_no가 E2E-로 시작하는 것)
  const { data: orders } = await adminClient
    .from("orders")
    .select("id")
    .like("order_no", "E2E-%")

  if (orders?.length) {
    const orderIds = orders.map((o) => o.id)
    await adminClient.from("order_items").delete().in("order_id", orderIds)
    await adminClient.from("orders").delete().in("id", orderIds)
  }
}

// --- 유저 ID 조회 ---

export const getUserIdByEmail = async (email: string) => {
  const { data } = await adminClient.auth.admin.listUsers()
  const user = data?.users?.find((u) => u.email === email)
  return user?.id
}
