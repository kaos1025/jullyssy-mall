import { notFound } from "next/navigation"
import { verifyAdmin } from "@/lib/api-helpers/verifyAdmin"
import { getHeroBannerByIdAdmin } from "@/lib/hero-banners"
import HeroBannerForm from "../HeroBannerForm"

interface EditHeroBannerPageProps {
  params: { id: string }
}

const EditHeroBannerPage = async ({ params }: EditHeroBannerPageProps) => {
  const user = await verifyAdmin()
  if (!user) notFound()

  const banner = await getHeroBannerByIdAdmin(params.id)
  if (!banner) notFound()

  return (
    <div className="space-y-6 max-w-3xl">
      <h1 className="text-2xl font-bold">메인 배너 수정</h1>
      <HeroBannerForm banner={banner} />
    </div>
  )
}

export default EditHeroBannerPage
