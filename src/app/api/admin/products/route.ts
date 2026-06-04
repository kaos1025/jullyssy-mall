import { NextRequest, NextResponse } from "next/server"
import { revalidatePath, revalidateTag } from "next/cache"
import { verifyAdmin } from "@/lib/api-helpers/verifyAdmin"
import { withRateLimit } from "@/lib/api-helpers/withRateLimit"
import { adminLimiter } from "@/lib/rate-limit/limiters"
import { createAdminClient } from "@/lib/supabase/admin"
import { buildApparelResolver, resolveWriteFitType } from "@/lib/product/category-server"

const getHandler = async (request: NextRequest) => {
  const user = await verifyAdmin()
  if (!user) {
    return NextResponse.json({ error: "권한이 없습니다" }, { status: 403 })
  }

  const admin = createAdminClient()
  const { searchParams } = request.nextUrl
  const status = searchParams.get("status") || "ALL"
  const search = searchParams.get("search") || ""
  const page = Math.max(1, parseInt(searchParams.get("page") || "1"))
  const perPage = Math.min(100, Math.max(1, parseInt(searchParams.get("per_page") || "20")))

  // 카테고리 전체 조회 (self-join 대신 별도 쿼리)
  // slug: 그리드 fit tri-state(GRID-NONAPPAREL-FIT-UI-1) 의류 판정용 — additive read-only
  const { data: allCategories } = await admin
    .from("categories")
    .select("id, name, parent_id, slug")

  const categoryMap = new Map<string, { name: string; parent_id: string | null }>()
  if (allCategories) {
    for (const c of allCategories) {
      categoryMap.set(c.id, { name: c.name, parent_id: c.parent_id })
    }
  }

  let query = admin
    .from("products")
    .select("*, product_options(stock), product_images(url, is_thumbnail)", { count: "exact" })
    .neq("status", "DELETED")
    .order("created_at", { ascending: false })

  if (status && status !== "ALL") {
    query = query.eq("status", status)
  }

  if (search) {
    query = query.ilike("name", `%${search}%`)
  }

  const from = (page - 1) * perPage
  const to = from + perPage - 1
  query = query.range(from, to)

  const { data, error, count } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const totalCount = count ?? 0

  const products = (data || []).map((p) => {
    // 썸네일: is_thumbnail=true 우선, 없으면 첫 번째 이미지
    const images = p.product_images || []
    const thumb = images.find((img: { is_thumbnail: boolean }) => img.is_thumbnail) || images[0]
    const thumbnail_url = thumb?.url || null

    // 카테고리명: 상위 > 하위
    let category_name: string | null = null
    if (p.category_id && categoryMap.has(p.category_id)) {
      const cat = categoryMap.get(p.category_id)!
      if (cat.parent_id && categoryMap.has(cat.parent_id)) {
        category_name = `${categoryMap.get(cat.parent_id)!.name} > ${cat.name}`
      } else {
        category_name = cat.name
      }
    }

    return {
      ...p,
      stock_sum:
        p.product_options?.reduce(
          (sum: number, o: { stock: number }) => sum + o.stock,
          0
        ) || 0,
      thumbnail_url,
      category_name,
    }
  })

  return NextResponse.json({ products, categories: allCategories || [], totalCount })
}

const postHandler = async (request: Request) => {
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

    // fit_type tri-state: category 존재+비의류만 NULL 강제, 무카테고리는 보존 (#2)
    const isApparel = await buildApparelResolver(admin)
    const fitType = resolveWriteFitType(
      productData.category_id || null,
      productData.fit_type,
      isApparel
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
        fit_type: fitType,
        status: productData.status || "ACTIVE",
        free_shipping: productData.free_shipping === true,
        search_tags: productData.search_tags || [],
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

    revalidatePath("/admin/products")
    revalidatePath("/products/[id]", "page")
    revalidateTag("products") // 목록 캐시(lib/products) 무효화

    return NextResponse.json({
      id: product.id,
      ...(uploadErrors.length > 0 && { image_errors: uploadErrors }),
    })
  } catch {
    return NextResponse.json({ error: "상품 등록 실패" }, { status: 500 })
  }
}

export const GET = withRateLimit(adminLimiter, getHandler)
export const POST = withRateLimit(adminLimiter, postHandler)
