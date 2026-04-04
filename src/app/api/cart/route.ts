import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

// GET /api/cart — 장바구니 조회
export const GET = async () => {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 })
  }

  const { data, error } = await supabase
    .from("cart_items")
    .select(
      `
      id,
      product_option_id,
      quantity,
      created_at,
      product_options (
        product_id,
        color,
        size,
        stock,
        extra_price,
        products (
          name,
          price,
          sale_price,
          status,
          product_images ( url, is_thumbnail )
        )
      )
    `
    )
    .order("created_at", { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const items = (data ?? []).map((ci: any) => {
    const po = ci.product_options
    const p = po.products
    const thumb =
      p.product_images?.find((img: { is_thumbnail: boolean }) => img.is_thumbnail)?.url ??
      p.product_images?.[0]?.url ??
      null
    const isSoldout = p.status !== "ACTIVE" || po.stock === 0

    return {
      id: ci.id,
      product_id: po.product_id,
      product_option_id: ci.product_option_id,
      product_name: p.name,
      product_image: thumb,
      color: po.color,
      size: po.size,
      price: p.sale_price ?? p.price,
      extra_price: po.extra_price,
      quantity: isSoldout ? ci.quantity : Math.min(ci.quantity, po.stock),
      stock: po.stock,
      soldout: isSoldout,
    }
  })

  return NextResponse.json(items)
}

// POST /api/cart — 장바구니 추가
export const POST = async (request: Request) => {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 })
  }

  const { product_option_id, quantity } = await request.json()
  if (!product_option_id || !quantity || quantity < 1) {
    return NextResponse.json({ error: "잘못된 요청입니다" }, { status: 400 })
  }

  // 재고 확인
  const { data: option } = await supabase
    .from("product_options")
    .select("stock")
    .eq("id", product_option_id)
    .single()

  if (!option || option.stock === 0) {
    return NextResponse.json({ error: "품절된 상품입니다" }, { status: 400 })
  }

  // 기존 장바구니 아이템 확인
  const { data: existing } = await supabase
    .from("cart_items")
    .select("id, quantity")
    .eq("user_id", user.id)
    .eq("product_option_id", product_option_id)
    .single()

  let capped = false

  if (existing) {
    const newQty = Math.min(existing.quantity + quantity, option.stock)
    capped = existing.quantity + quantity > option.stock

    const { error } = await supabase
      .from("cart_items")
      .update({ quantity: newQty })
      .eq("id", existing.id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
  } else {
    const newQty = Math.min(quantity, option.stock)
    capped = quantity > option.stock

    const { error } = await supabase.from("cart_items").insert({
      user_id: user.id,
      product_option_id,
      quantity: newQty,
    })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
  }

  return NextResponse.json({ success: true, capped })
}

// PATCH /api/cart — 수량 변경
export const PATCH = async (request: Request) => {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 })
  }

  const { product_option_id, quantity } = await request.json()
  if (!product_option_id || quantity == null) {
    return NextResponse.json({ error: "잘못된 요청입니다" }, { status: 400 })
  }

  // 재고 확인
  const { data: option } = await supabase
    .from("product_options")
    .select("stock")
    .eq("id", product_option_id)
    .single()

  if (!option) {
    return NextResponse.json({ error: "상품을 찾을 수 없습니다" }, { status: 404 })
  }

  const clampedQty = Math.max(1, Math.min(quantity, option.stock))

  const { error } = await supabase
    .from("cart_items")
    .update({ quantity: clampedQty })
    .eq("user_id", user.id)
    .eq("product_option_id", product_option_id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, quantity: clampedQty })
}

// DELETE /api/cart — 장바구니 삭제
export const DELETE = async (request: Request) => {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 })
  }

  const { product_option_id } = await request.json()
  if (!product_option_id) {
    return NextResponse.json({ error: "잘못된 요청입니다" }, { status: 400 })
  }

  const { error } = await supabase
    .from("cart_items")
    .delete()
    .eq("user_id", user.id)
    .eq("product_option_id", product_option_id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
