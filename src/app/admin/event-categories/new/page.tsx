import EventCategoryForm from "../EventCategoryForm"

const NewEventCategoryPage = () => {
  return (
    <div className="space-y-6 max-w-3xl">
      <h1 className="text-2xl font-bold">신규 이벤트 카테고리</h1>
      <EventCategoryForm />
    </div>
  )
}

export default NewEventCategoryPage
