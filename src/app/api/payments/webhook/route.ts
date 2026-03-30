import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"

export const POST = async (request: Request) => {
  const body = await request.json()
  const { eventType, data } = body

  const admin = createAdminClient()

  switch (eventType) {
    case "PAYMENT_STATUS_CHANGED": {
      const { paymentKey, status } = data

      // 결제 상태 업데이트
      if (paymentKey) {
        await admin
          .from("payments")
          .update({
            status: status === "DONE" ? "DONE" : status,
            raw_response: data,
          })
          .eq("payment_key", paymentKey)

        // 입금확인 (가상계좌)
        if (status === "DONE") {
          const { data: payment } = await admin
            .from("payments")
            .select("order_id")
            .eq("payment_key", paymentKey)
            .single()

          if (payment) {
            await admin
              .from("orders")
              .update({ status: "PAID" })
              .eq("id", payment.order_id)
          }
        }
      }
      break
    }
  }

  return NextResponse.json({ success: true })
}
