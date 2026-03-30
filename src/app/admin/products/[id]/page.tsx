"use client"

import { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import ProductForm from "../ProductForm"

const EditProductPage = () => {
  const params = useParams()
  const [product, setProduct] = useState<unknown>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchProduct = async () => {
      const supabase = createClient()
      const { data } = await supabase
        .from("products")
        .select("*, product_options(*), product_images(*)")
        .eq("id", params.id)
        .single()

      if (data) setProduct(data)
      setLoading(false)
    }
    fetchProduct()
  }, [params.id])

  if (loading) {
    return <div className="text-center py-20 text-muted-foreground">로딩 중...</div>
  }

  if (!product) {
    return <div className="text-center py-20 text-muted-foreground">상품을 찾을 수 없습니다.</div>
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">상품 수정</h1>
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      <ProductForm product={product as any} />
    </div>
  )
}

export default EditProductPage
