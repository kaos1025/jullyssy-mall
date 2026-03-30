import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import dayjs from "dayjs"

const generateOrderNo = () => {
  const now = dayjs().format("YYYYMMDDHHmmss")
  const rand = Math.floor(1000 + Math.random() * 9000)
  return `${now}${rand}`
}

export const POST = async (request: Request) => {
  const supabase = createClient()
  const admin = createAdminClient()

  // 인증 확인
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 })
  }

  const body = await request.json()
  const { items, address, coupon_id, point_used, shipping_fee } = body

  if (!items || items.length === 0) {
    return NextResponse.json({ error: "주문 상품이 없습니다" }, { status: 400 })
  }

  // 총 금액 계산
  const totalAmount = items.reduce(
    (sum: number, item: { price: number; quantity: number }) =>
      sum + item.price * item.quantity,
    0
  )

  // 쿠폰 할인 계산
  let discountAmount = 0
  if (coupon_id) {
    const { data: userCoupon } = await admin
      .from("user_coupons")
      .select("*, coupon:coupons(*)")
      .eq("id", coupon_id)
      .eq("user_id", user.id)
      .is("used_at", null)
      .single()

    if (userCoupon?.coupon) {
      const coupon = userCoupon.coupon
      if (coupon.type === "FIXED") {
        discountAmount = coupon.discount_value
      } else {
        discountAmount = Math.round(
          (totalAmount * coupon.discount_value) / 100
        )
        if (coupon.max_discount) {
          discountAmount = Math.min(discountAmount, coupon.max_discount)
        }
      }
    }
  }

  // 포인트 검증
  const validPointUsed = point_used || 0
  if (validPointUsed > 0) {
    const { data: profile } = await admin
      .from("profiles")
      .select("point")
      .eq("id", user.id)
      .single()

    if (!profile || profile.point < validPointUsed) {
      return NextResponse.json(
        { error: "포인트가 부족합니다" },
        { status: 400 }
      )
    }
  }

  const paidAmount =
    totalAmount - discountAmount - validPointUsed + (shipping_fee || 0)

  if (paidAmount < 0) {
    return NextResponse.json(
      { error: "결제 금액이 올바르지 않습니다" },
      { status: 400 }
    )
  }

  const orderNo = generateOrderNo()

  // 트랜잭션: 주문 생성 + 재고 차감
  // 1. 재고 확인 및 차감
  for (const item of items) {
    const { data: option } = await admin
      .from("product_options")
      .select("stock")
      .eq("id", item.product_option_id)
      .single()

    if (!option || option.stock < item.quantity) {
      return NextResponse.json(
        {
          error: `재고가 부족합니다: ${item.product_name} (${item.color}/${item.size})`,
        },
        { status: 400 }
      )
    }

    const { error: stockError } = await admin
      .from("product_options")
      .update({ stock: option.stock - item.quantity })
      .eq("id", item.product_option_id)

    if (stockError) {
      return NextResponse.json(
        { error: "재고 차감 실패" },
        { status: 500 }
      )
    }
  }

  // 2. 주문 생성
  const { data: order, error: orderError } = await admin
    .from("orders")
    .insert({
      user_id: user.id,
      order_no: orderNo,
      status: "PENDING",
      total_amount: totalAmount,
      discount_amount: discountAmount,
      point_used: validPointUsed,
      shipping_fee: shipping_fee || 0,
      paid_amount: paidAmount,
      recipient: address.recipient,
      recipient_phone: address.phone,
      zipcode: address.zipcode,
      address1: address.address1,
      address2: address.address2 || null,
      delivery_memo: address.memo || null,
    })
    .select()
    .single()

  if (orderError || !order) {
    return NextResponse.json(
      { error: "주문 생성 실패" },
      { status: 500 }
    )
  }

  // 3. 주문 상품 생성
  const orderItems = items.map(
    (item: {
      product_id: string
      product_option_id: string
      product_name: string
      product_image: string | null
      color: string
      size: string
      price: number
      quantity: number
    }) => ({
      order_id: order.id,
      product_id: item.product_id,
      product_option_id: item.product_option_id,
      product_name: item.product_name,
      product_image: item.product_image,
      color: item.color,
      size: item.size,
      price: item.price,
      quantity: item.quantity,
    })
  )

  await admin.from("order_items").insert(orderItems)

  // 4. 쿠폰 사용 처리
  if (coupon_id) {
    await admin
      .from("user_coupons")
      .update({ used_at: new Date().toISOString(), order_id: order.id })
      .eq("id", coupon_id)
  }

  // 5. 포인트 차감
  if (validPointUsed > 0) {
    const { data: currentProfile } = await admin
      .from("profiles")
      .select("point")
      .eq("id", user.id)
      .single()

    if (currentProfile) {
      await admin
        .from("profiles")
        .update({ point: currentProfile.point - validPointUsed })
        .eq("id", user.id)
    }

    await admin.from("point_histories").insert({
      user_id: user.id,
      amount: -validPointUsed,
      reason: "주문 사용",
      order_id: order.id,
    })
  }

  return NextResponse.json({
    order_id: order.id,
    order_no: orderNo,
    amount: paidAmount,
  })
}
