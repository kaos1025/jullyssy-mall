import { redirect } from "next/navigation"
import { verifyAdmin } from "@/lib/api-helpers/verifyAdmin"
import { getSeoDraftsPendingPaginatedAdmin } from "@/lib/seo/drafts"
import BulkReviewClient from "../_components/bulk-review-client"

// admin 페이지 Full Route Cache 회피 (단건 검수 페이지와 동일).
export const dynamic = "force-dynamic"

const BULK_LIMIT = 100

const SeoDraftsBulkPage = async () => {
  const admin = await verifyAdmin()
  if (!admin) redirect("/")

  const initial = await getSeoDraftsPendingPaginatedAdmin(BULK_LIMIT, 0)

  return (
    <BulkReviewClient
      initialDrafts={initial.drafts}
      initialTotal={initial.total}
      limit={BULK_LIMIT}
    />
  )
}

export default SeoDraftsBulkPage
