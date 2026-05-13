import { notFound } from "next/navigation"
import { verifyAdmin } from "@/lib/api-helpers/verifyAdmin"
import {
  getEventCategoryByIdAdmin,
  getEventCategoryProductsAdmin,
} from "@/lib/events"
import EventCategoryForm from "../EventCategoryForm"
import ProductMatchingSection from "../ProductMatchingSection"
import { Separator } from "@/components/ui/separator"

interface EditEventCategoryPageProps {
  params: { id: string }
}

const EditEventCategoryPage = async ({ params }: EditEventCategoryPageProps) => {
  const user = await verifyAdmin()
  if (!user) notFound()

  const category = await getEventCategoryByIdAdmin(params.id)
  if (!category) notFound()

  const initialProducts = await getEventCategoryProductsAdmin(params.id)

  return (
    <div className="space-y-8 max-w-3xl">
      <h1 className="text-2xl font-bold">이벤트 카테고리 수정</h1>
      <EventCategoryForm category={category} />

      <Separator />

      <ProductMatchingSection
        eventCategoryId={category.id}
        initialProducts={initialProducts}
      />
    </div>
  )
}

export default EditEventCategoryPage
