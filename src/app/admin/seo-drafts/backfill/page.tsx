import { redirect } from "next/navigation"
import { verifyAdmin } from "@/lib/api-helpers/verifyAdmin"
import BackfillForm from "./_components/backfill-form"

export const dynamic = "force-dynamic"

const AdminSeoBackfillPage = async () => {
  const admin = await verifyAdmin()
  if (!admin) redirect("/")
  return <BackfillForm />
}

export default AdminSeoBackfillPage
