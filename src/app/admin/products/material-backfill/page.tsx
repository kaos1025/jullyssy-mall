import { redirect } from "next/navigation"
import { verifyAdmin } from "@/lib/api-helpers/verifyAdmin"
import { getMaterialBackfillCandidates } from "@/lib/product/material-backfill"
import MaterialBackfillClient from "./_components/material-backfill-client"

export const dynamic = "force-dynamic"

const MaterialBackfillPage = async () => {
  const admin = await verifyAdmin()
  if (!admin) redirect("/")

  const candidates = await getMaterialBackfillCandidates()

  return <MaterialBackfillClient initialCandidates={candidates} />
}

export default MaterialBackfillPage
