import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

const verifyAdmin = async () => {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const adminEmails = (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())

  if (!adminEmails.includes(user.email?.toLowerCase() || "")) return null
  return user
}

export const GET = async (request: NextRequest) => {
  const admin = createAdminClient()
  const { searchParams } = request.nextUrl
  const status = searchParams.get("status") || "ALL"
  const search = searchParams.get("search") || ""

  let query = admin
    .from("products")
    .select("*, product_options(stock)")
    .neq("status", "DELETED")
    .order("created_at", { ascending: false })

  if (status && status !== "ALL") {
    query = query.eq("status", status)
  }

  if (search) {
    query = query.ilike("name", `%${search}%`)
  }

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const products = (data || []).map((p) => ({
    ...p,
    stock_sum:
      p.product_options?.reduce(
        (sum: number, o: { stock: number }) => sum + o.stock,
        0
      ) || 0,
  }))

  return NextResponse.json(products)
}

export const POST = async (request: Request) => {
  const user = await verifyAdmin()
  if (!user) {
    return NextResponse.json({ error: "권한이 없습니다" }, { status: 403 })
  }

  const admin = createAdminClient()

  try {
    const formData = await request.formData()
    const productData = JSON.parse(formData.get("product") as string)
    const optionsData = JSON.parse(formData.get("options") as string)
    const imageFiles: File[] = []
    formData.getAll("images").forEach((f) => {
      if (f instanceof File && f.size > 0) imageFiles.push(f)
    })
    const existingImageIds = JSON.parse(
      (formData.get("existing_image_ids") as string) || "[]"
    )

    // 1. 상품 등록
    const { data: product, error } = await admin
      .from("products")
      .insert({
        name: productData.name,
        slug: productData.slug || null,
        category_id: productData.category_id || null,
        price: productData.price,
        sale_price: productData.sale_price || null,
        description: productData.description || null,
        material: productData.material || null,
        care_info: productData.care_info || null,
        origin: productData.origin || null,
        status: productData.status || "ACTIVE",
      })
      .select()
      .single()

    if (error || !product) {
      return NextResponse.json(
        { error: error?.message || "상품 등록 실패" },
        { status: 500 }
      )
    }

    // 2. 옵션 등록
    const validOptions = optionsData.filter(
      (o: { color: string; size: string }) => o.color && o.size
    )
    if (validOptions.length > 0) {
      await admin.from("product_options").insert(
        validOptions.map(
          (o: {
            color: string
            size: string
            extra_price: number
            stock: number
            sku: string
          }) => ({
            product_id: product.id,
            color: o.color,
            size: o.size,
            extra_price: o.extra_price || 0,
            stock: o.stock || 0,
            sku: o.sku || null,
          })
        )
      )
    }

    // 3. 이미지 업로드
    const existingCount = existingImageIds.length
    const uploadErrors: string[] = []
    for (let i = 0; i < imageFiles.length; i++) {
      const file = imageFiles[i]
      const ext = file.name.split(".").pop()
      const path = `products/${product.id}/${Date.now()}_${i}.${ext}`
      const buffer = Buffer.from(await file.arrayBuffer())

      const { error: uploadError } = await admin.storage
        .from("product-images")
        .upload(path, buffer, { contentType: file.type })

      if (uploadError) {
        uploadErrors.push(`${file.name}: ${uploadError.message}`)
        continue
      }

      const {
        data: { publicUrl },
      } = admin.storage.from("product-images").getPublicUrl(path)

      await admin.from("product_images").insert({
        product_id: product.id,
        url: publicUrl,
        is_thumbnail: existingCount === 0 && i === 0,
        sort_order: existingCount + i,
      })
    }

    return NextResponse.json({
      id: product.id,
      ...(uploadErrors.length > 0 && { image_errors: uploadErrors }),
    })
  } catch {
    return NextResponse.json({ error: "상품 등록 실패" }, { status: 500 })
  }
}
