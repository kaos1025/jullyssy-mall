import { notFound } from "next/navigation"
import { verifyAdmin } from "@/lib/api-helpers/verifyAdmin"
import ProductForm from "../ProductForm"

const NewProductPage = async () => {
  const user = await verifyAdmin()
  if (!user) notFound()

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">상품 등록</h1>
      <ProductForm />
    </div>
  )
}

export default NewProductPage
