import { notFound } from "next/navigation"
import { verifyAdmin } from "@/lib/api-helpers/verifyAdmin"
import { getTopBannerByIdAdmin } from "@/lib/banners"
import BannerForm from "../BannerForm"

interface EditBannerPageProps {
  params: { id: string }
}

const EditBannerPage = async ({ params }: EditBannerPageProps) => {
  const user = await verifyAdmin()
  if (!user) notFound()

  const banner = await getTopBannerByIdAdmin(params.id)
  if (!banner) notFound()

  return (
    <div className="space-y-6 max-w-3xl">
      <h1 className="text-2xl font-bold">배너 수정</h1>
      <BannerForm banner={banner} />
    </div>
  )
}

export default EditBannerPage
