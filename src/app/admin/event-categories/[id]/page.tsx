import { notFound } from "next/navigation"
import { getEventCategoryByIdAdmin } from "@/lib/events"
import EventCategoryForm from "../EventCategoryForm"

interface EditEventCategoryPageProps {
  params: { id: string }
}

const EditEventCategoryPage = async ({ params }: EditEventCategoryPageProps) => {
  const category = await getEventCategoryByIdAdmin(params.id)
  if (!category) notFound()

  return (
    <div className="space-y-6 max-w-3xl">
      <h1 className="text-2xl font-bold">이벤트 카테고리 수정</h1>
      <EventCategoryForm category={category} />
    </div>
  )
}

export default EditEventCategoryPage
