import { redirect } from "next/navigation"
import { verifyAdmin } from "@/lib/api-helpers/verifyAdmin"
import {
  getSeoDraftDetailAdmin,
  getSeoDraftsPendingPaginatedAdmin,
} from "@/lib/seo/drafts"
import SeoDraftsClient from "./_components/seo-drafts-client"

// Day 18 학습: admin 페이지 Full Route Cache 회피.
export const dynamic = "force-dynamic"

const PER_PAGE = 20

const AdminSeoDraftsPage = async () => {
  const admin = await verifyAdmin()
  if (!admin) redirect("/")

  // DUPLICATE-FETCH-AUDIT-1 (P1): list와 첫 draft detail을 Server에서 병렬
  // prefetch하여 client mount 후 추가 fetch 없이 즉시 미리보기.
  // (이전: client useEffect가 첫 draft detail을 별도 API 호출 → ~957ms waterfall)
  const initial = await getSeoDraftsPendingPaginatedAdmin(PER_PAGE, 0)
  const firstId = initial.drafts[0]?.id ?? null
  const initialDetail = firstId ? await getSeoDraftDetailAdmin(firstId) : null

  return (
    <SeoDraftsClient
      initialDrafts={initial.drafts}
      initialTotal={initial.total}
      initialDetail={initialDetail}
      perPage={PER_PAGE}
    />
  )
}

export default AdminSeoDraftsPage
