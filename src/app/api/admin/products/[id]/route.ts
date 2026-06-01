import { NextResponse } from "next/server"
import * as Sentry from "@sentry/nextjs"
import { revalidatePath } from "next/cache"
import { verifyAdmin } from "@/lib/api-helpers/verifyAdmin"
import { withRateLimit } from "@/lib/api-helpers/withRateLimit"
import { adminLimiter } from "@/lib/rate-limit/limiters"
import { createAdminClient } from "@/lib/supabase/admin"
import { parseFitType } from "@/lib/product/fit-type"

const putHandler = async (
  request: Request,
  { params }: { params: { id: string } }
) => {
  const user = await verifyAdmin()
  if (!user) {
    return NextResponse.json({ error: "권한이 없습니다" }, { status: 403 })
  }

  const admin = createAdminClient()
  const productId = params.id

  try {
    const formData = await request.formData()
    const productData = JSON.parse(formData.get("product") as string)
    const optionsData = JSON.parse(formData.get("options") as string)
    const imageFiles: File[] = []
    formData.getAll("images").forEach((f) => {
      if (f instanceof File && f.size > 0) imageFiles.push(f)
    })
    const existingImageIds: string[] = JSON.parse(
      (formData.get("existing_image_ids") as string) || "[]"
    )
    // fit_type 변경 모달에서 [재생성 큐 적재] 선택 시에만 true (B-2 / G2)
    const enqueueSeo = formData.get("enqueue_seo") === "true"

    // 1. 상품 수정
    const { error } = await admin
      .from("products")
      .update({
        name: productData.name,
        slug: productData.slug || null,
        category_id: productData.category_id || null,
        price: productData.price,
        sale_price: productData.sale_price || null,
        description: productData.description || null,
        material: productData.material || null,
        care_info: productData.care_info || null,
        origin: productData.origin || null,
        fit_type: parseFitType(productData.fit_type) ?? "REGULAR",
        status: productData.status || "ACTIVE",
        free_shipping: productData.free_shipping === true,
        search_tags: productData.search_tags || [],
      })
      .eq("id", productId)

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      )
    }

    // 1-b. fit_type 변경 시 SEO 재생성 큐 적재 (모달 [재생성 큐 적재] 선택 시에만)
    // G2: products edit 경로 전용 INSERT — seo-drafts 즉시 sync 경로와 책임 분리, pending 중복 방지
    let seoEnqueued: "queued" | "already_pending" | "skipped" = "skipped"
    if (enqueueSeo) {
      const { data: pending } = await admin
        .from("seo_generation_queue")
        .select("id")
        .eq("product_id", productId)
        .eq("status", "pending")
        .maybeSingle()

      if (pending) {
        seoEnqueued = "already_pending"
      } else {
        const { error: queueErr } = await admin
          .from("seo_generation_queue")
          .insert({
            product_id: productId,
            status: "pending",
            trigger_source: "admin_fit_change",
            description_mode: "replace",
          })

        if (queueErr) {
          // 상품 수정은 이미 커밋됨 — 큐 적재 실패는 soft-fail (Sentry 기록 후 진행)
          Sentry.captureException(queueErr, {
            tags: {
              seo_event: "admin_fit_change_enqueue_failed",
              product_id: productId,
            },
          })
        } else {
          seoEnqueued = "queued"
        }
      }
    }

    // 2. 삭제된 이미지 제거 (existing_image_ids에 없는 기존 이미지 삭제)
    if (existingImageIds.length >= 0) {
      const { data: currentImages } = await admin
        .from("product_images")
        .select("id")
        .eq("product_id", productId)

      if (currentImages) {
        const toDelete = currentImages
          .filter((img) => !existingImageIds.includes(img.id))
          .map((img) => img.id)

        if (toDelete.length > 0) {
          await admin
            .from("product_images")
            .delete()
            .in("id", toDelete)
        }
      }
    }

    // 3. 옵션 교체 (전체 삭제 후 재등록)
    await admin
      .from("product_options")
      .delete()
      .eq("product_id", productId)

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
            product_id: productId,
            color: o.color,
            size: o.size,
            extra_price: o.extra_price || 0,
            stock: o.stock || 0,
            sku: o.sku || null,
          })
        )
      )
    }

    // 4. 새 이미지 업로드
    const existingCount = existingImageIds.length
    const uploadErrors: string[] = []
    for (let i = 0; i < imageFiles.length; i++) {
      const file = imageFiles[i]
      const ext = file.name.split(".").pop()
      const path = `products/${productId}/${Date.now()}_${i}.${ext}`
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
        product_id: productId,
        url: publicUrl,
        is_thumbnail: existingCount === 0 && i === 0,
        sort_order: existingCount + i,
      })
    }

    revalidatePath("/admin/products")
    revalidatePath("/admin/products/[id]", "page")
    revalidatePath("/products/[id]", "page")

    return NextResponse.json({
      id: productId,
      seo_enqueued: seoEnqueued,
      ...(uploadErrors.length > 0 && { image_errors: uploadErrors }),
    })
  } catch {
    return NextResponse.json({ error: "상품 수정 실패" }, { status: 500 })
  }
}

const patchHandler = async (
  request: Request,
  { params }: { params: { id: string } }
) => {
  const user = await verifyAdmin()
  if (!user) {
    return NextResponse.json({ error: "권한이 없습니다" }, { status: 403 })
  }

  const admin = createAdminClient()
  const productId = params.id

  try {
    const body = await request.json()
    const allowed = ["name", "price", "sale_price", "status", "category_id"]
    const updates: Record<string, unknown> = {}

    for (const key of allowed) {
      if (key in body) {
        updates[key] = body[key]
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "변경할 항목이 없습니다" }, { status: 400 })
    }

    const { error } = await admin
      .from("products")
      .update(updates)
      .eq("id", productId)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    revalidatePath("/admin/products")
    revalidatePath("/admin/products/[id]", "page")
    revalidatePath("/products/[id]", "page")

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: "상품 수정 실패" }, { status: 500 })
  }
}

const deleteHandler = async (
  _request: Request,
  { params }: { params: { id: string } }
) => {
  const user = await verifyAdmin()
  if (!user) {
    return NextResponse.json({ error: "권한이 없습니다" }, { status: 403 })
  }

  const admin = createAdminClient()

  const { error } = await admin
    .from("products")
    .update({ status: "DELETED" })
    .eq("id", params.id)

  if (error) {
    return NextResponse.json({ error: "삭제 실패" }, { status: 500 })
  }

  revalidatePath("/admin/products")
  revalidatePath("/admin/products/[id]", "page")
  revalidatePath("/products/[id]", "page")

  return NextResponse.json({ success: true })
}

export const PUT = withRateLimit(adminLimiter, putHandler)
export const PATCH = withRateLimit(adminLimiter, patchHandler)
export const DELETE = withRateLimit(adminLimiter, deleteHandler)
