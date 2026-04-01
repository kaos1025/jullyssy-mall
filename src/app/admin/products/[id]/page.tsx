import { notFound } from "next/navigation"
import { createAdminClient } from "@/lib/supabase/admin"
import ProductForm from "../ProductForm"

interface EditProductPageProps {
  params: { id: string }
}

const EditProductPage = async ({ params }: EditProductPageProps) => {
  const admin = createAdminClient()
  const { data: product } = await admin
    .from("products")
    .select("*, product_options(*), product_images(*)")
    .eq("id", params.id)
    .single()

  if (!product) notFound()

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">상품 수정</h1>
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      <ProductForm product={product as any} />
    </div>
  )
}

export default EditProductPage
