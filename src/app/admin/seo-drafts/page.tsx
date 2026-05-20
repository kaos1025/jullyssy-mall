import { redirect } from "next/navigation"
import { verifyAdmin } from "@/lib/api-helpers/verifyAdmin"
import { getSeoDraftsPendingPaginatedAdmin } from "@/lib/seo/drafts"
import SeoDraftsClient from "./_components/seo-drafts-client"

// Day 18 학습: admin 페이지 Full Route Cache 회피.
export const dynamic = "force-dynamic"

const PER_PAGE = 20

const AdminSeoDraftsPage = async () => {
  const admin = await verifyAdmin()
  if (!admin) redirect("/")

  const initial = await getSeoDraftsPendingPaginatedAdmin(PER_PAGE, 0)

  return (
    <SeoDraftsClient
      initialDrafts={initial.drafts}
      initialTotal={initial.total}
      perPage={PER_PAGE}
    />
  )
}

export default AdminSeoDraftsPage
