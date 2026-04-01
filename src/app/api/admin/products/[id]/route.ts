import { NextResponse } from "next/server"
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

export const PUT = async (
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
        status: productData.status || "ACTIVE",
      })
      .eq("id", productId)

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      )
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
    for (let i = 0; i < imageFiles.length; i++) {
      const file = imageFiles[i]
      const ext = file.name.split(".").pop()
      const path = `products/${productId}/${Date.now()}_${i}.${ext}`
      const buffer = Buffer.from(await file.arrayBuffer())

      const { error: uploadError } = await admin.storage
        .from("product-images")
        .upload(path, buffer, { contentType: file.type })

      if (!uploadError) {
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
    }

    return NextResponse.json({ id: productId })
  } catch {
    return NextResponse.json({ error: "상품 수정 실패" }, { status: 500 })
  }
}

export const DELETE = async (
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

  return NextResponse.json({ success: true })
}
