// P1-16 반품/교환 오케스트레이션 (spec v0.2 §3). 결제/회계 부수효과는 단일 RPC 트랜잭션으로 위임,
// 본 모듈은 자격검증 + Toss 호출 순서 + 이메일 부수효과를 담당. 전부 service_role(admin) 경유.
// cancelOrder의 무트랜잭션 패턴 상속 금지 — DB 정합은 process_return_refund/process_exchange_reship RPC.
import { createAdminClient } from "@/lib/supabase/admin"
import { tossCancel } from "@/lib/payment/toss-cancel"
import {
  claimRequestedOrderStatus,
  claimTerminalOrderStatus,
} from "@/lib/order/status-transitions"
import {
  ACTIVE_CLAIM_STATUSES,
  CLAIM_TYPE_LABEL,
  computeProposedDeduction,
  type ClaimType,
  type ReasonCategory,
} from "@/lib/order/claim"
import {
  sendClaimApproved,
  sendClaimRejected,
  sendRefundCompleted,
  sendShippingStarted,
} from "@/lib/email/send"
import {
  formatKST,
  getOrderDetailUrl,
  getPaymentMethodLabel,
  getRefundEta,
  resolveUserEmail,
} from "@/lib/email/mappers"
import { buildTrackingUrl } from "@/lib/order/tracking-url"
import { RETURN_CONFIG } from "@/constants/shipping"
import type { Database, Json } from "@/types/supabase"

type Claim = Database["public"]["Tables"]["order_claims"]["Row"]
type AdminClient = ReturnType<typeof createAdminClient>

export type ClaimResult =
  | { ok: true; claimId?: string }
  | { ok: false; error: string; status: number }

const RETURN_ELIGIBLE_STATUSES = ["DELIVERED", "CONFIRMED"]

type EmailItem = { product_name: string; color: string; size: string; quantity: number }

const mapItems = (items: EmailItem[]) =>
  items.map((i) => ({
    productName: i.product_name,
    optionName: `${i.color} / ${i.size}`,
    quantity: i.quantity,
  }))

// 이메일 발송용 주문 컨텍스트 로드 (수신자 + 주소 스냅샷 + 상품 + 결제수단).
const loadOrderEmailCtx = async (admin: AdminClient, orderId: string) => {
  const { data: order } = await admin
    .from("orders")
    .select(
      "order_no, recipient, recipient_phone, zipcode, address1, address2, user_id, paid_amount, order_items(product_name, color, size, quantity), payments(method)"
    )
    .eq("id", orderId)
    .single()
  if (!order) return null
  const email = await resolveUserEmail(order.user_id)
  if (!email) return null
  return { order, email }
}

const paymentMethodOf = (payments: unknown): string | undefined =>
  Array.isArray(payments)
    ? (payments[0] as { method?: string } | undefined)?.method
    : (payments as { method?: string } | null)?.method

// =============================================
// 사용자: claim 생성 / 철회
// =============================================
export const createClaim = async (params: {
  orderId: string
  userId: string
  type: ClaimType
  reasonCategory: ReasonCategory
  reasonDetail?: string | null
  exchangeToOptionId?: string | null
}): Promise<ClaimResult> => {
  const admin = createAdminClient()

  const { data: order } = await admin
    .from("orders")
    .select("status, shipping_fee, delivered_at, updated_at, order_items(product_option_id, quantity)")
    .eq("id", params.orderId)
    .eq("user_id", params.userId)
    .single()
  if (!order) return { ok: false, error: "주문을 찾을 수 없습니다", status: 404 }

  if (!RETURN_ELIGIBLE_STATUSES.includes(order.status)) {
    return { ok: false, error: "배송완료 후에만 반품/교환을 신청할 수 있습니다", status: 400 }
  }

  // 신청 기한: COALESCE(delivered_at, updated_at) + windowDays (delivered_at 자주 NULL — Phase0 실측).
  const base = order.delivered_at ?? order.updated_at
  const deadline = new Date(base).getTime() + RETURN_CONFIG.windowDays * 86_400_000
  if (Date.now() > deadline) {
    return { ok: false, error: "반품/교환 신청 기한(7일)이 지났습니다", status: 400 }
  }

  const { data: active } = await admin
    .from("order_claims")
    .select("id")
    .eq("order_id", params.orderId)
    .in("status", [...ACTIVE_CLAIM_STATUSES])
    .maybeSingle()
  if (active) return { ok: false, error: "이미 진행 중인 반품/교환이 있습니다", status: 409 }

  const orderItems = order.order_items ?? []

  if (params.type === "EXCHANGE") {
    if (orderItems.length !== 1) {
      return {
        ok: false,
        error: "교환은 단일 상품 주문만 가능합니다. 반품 후 재주문해주세요.",
        status: 400,
      }
    }
    if (!params.exchangeToOptionId) {
      return { ok: false, error: "교환할 옵션을 선택해주세요", status: 400 }
    }
    const source = orderItems[0]
    const { data: srcOpt } = await admin
      .from("product_options")
      .select("product_id, extra_price")
      .eq("id", source.product_option_id ?? "")
      .single()
    const { data: tgtOpt } = await admin
      .from("product_options")
      .select("product_id, extra_price, stock")
      .eq("id", params.exchangeToOptionId)
      .single()
    if (!srcOpt || !tgtOpt) {
      return { ok: false, error: "옵션 정보를 찾을 수 없습니다", status: 400 }
    }
    if (srcOpt.product_id !== tgtOpt.product_id) {
      return { ok: false, error: "같은 상품 내 옵션으로만 교환할 수 있습니다", status: 400 }
    }
    if (srcOpt.extra_price !== tgtOpt.extra_price) {
      return { ok: false, error: "가격이 동일한 옵션으로만 교환할 수 있습니다", status: 400 }
    }
    if (tgtOpt.stock < source.quantity) {
      return { ok: false, error: "교환할 옵션의 재고가 부족합니다", status: 400 }
    }
  }

  const proposed = computeProposedDeduction(params.reasonCategory, order.shipping_fee)

  const { data: claim, error: insErr } = await admin
    .from("order_claims")
    .insert({
      order_id: params.orderId,
      user_id: params.userId,
      type: params.type,
      reason_category: params.reasonCategory,
      reason_detail: params.reasonDetail ?? null,
      prev_order_status: order.status,
      proposed_deduction: proposed,
      exchange_to_option_id:
        params.type === "EXCHANGE" ? params.exchangeToOptionId ?? null : null,
    })
    .select("id")
    .single()
  if (insErr || !claim) {
    if (insErr?.code === "23505") {
      return { ok: false, error: "이미 진행 중인 반품/교환이 있습니다", status: 409 }
    }
    return { ok: false, error: "신청 처리에 실패했습니다", status: 500 }
  }

  await admin
    .from("orders")
    .update({ status: claimRequestedOrderStatus(params.type) })
    .eq("id", params.orderId)

  return { ok: true, claimId: claim.id }
}

export const withdrawClaim = async (
  claimId: string,
  userId: string
): Promise<ClaimResult> => {
  const admin = createAdminClient()
  const { data: claim } = await admin
    .from("order_claims")
    .select("*")
    .eq("id", claimId)
    .single()
  if (!claim) return { ok: false, error: "클레임을 찾을 수 없습니다", status: 404 }
  if (claim.user_id !== userId) {
    return { ok: false, error: "권한이 없습니다", status: 403 }
  }
  if (claim.status !== "REQUESTED") {
    return { ok: false, error: "접수 상태에서만 철회할 수 있습니다", status: 409 }
  }
  const { data: updated } = await admin
    .from("order_claims")
    .update({ status: "WITHDRAWN" })
    .eq("id", claimId)
    .eq("status", "REQUESTED")
    .select("id")
  if (!updated || updated.length === 0) {
    return { ok: false, error: "이미 처리된 신청입니다", status: 409 }
  }
  await admin
    .from("orders")
    .update({ status: claim.prev_order_status })
    .eq("id", claim.order_id)
  return { ok: true }
}

// =============================================
// 어드민: 승인 / 거절 / 회수완료 / 환불 / 재발송 / 교환완료
// =============================================
const dispatchDecisionEmail = async (
  admin: AdminClient,
  claim: Claim,
  kind: "approved" | "rejected",
  extra: { deductionAmount?: number; rejectedReason?: string }
) => {
  const ctx = await loadOrderEmailCtx(admin, claim.order_id)
  if (!ctx) return
  const common = {
    to: ctx.email,
    customerName: ctx.order.recipient,
    orderNo: ctx.order.order_no,
    claimType: CLAIM_TYPE_LABEL[claim.type as ClaimType],
    items: mapItems(ctx.order.order_items ?? []),
    orderDetailUrl: getOrderDetailUrl(claim.order_id),
    context: { claimId: claim.id, orderId: claim.order_id },
  }
  if (kind === "approved") {
    sendClaimApproved({
      ...common,
      deductionAmount: extra.deductionAmount ?? 0,
      pickupAddress: RETURN_CONFIG.pickupAddress,
    })
  } else {
    sendClaimRejected({ ...common, rejectedReason: extra.rejectedReason ?? "" })
  }
}

export const approveClaim = async (
  claimId: string,
  confirmedDeduction: number,
  processedBy: string
): Promise<ClaimResult> => {
  const admin = createAdminClient()
  const { data: claim } = await admin
    .from("order_claims")
    .select("*")
    .eq("id", claimId)
    .single()
  if (!claim) return { ok: false, error: "클레임을 찾을 수 없습니다", status: 404 }
  if (claim.status !== "REQUESTED") {
    return { ok: false, error: "접수 상태에서만 승인할 수 있습니다", status: 409 }
  }
  if (!Number.isInteger(confirmedDeduction) || confirmedDeduction < 0) {
    return { ok: false, error: "차감액은 0 이상 정수여야 합니다", status: 400 }
  }
  // 상태 술어를 UPDATE에 포함 → 경합/더블클릭 시 DB가 단일 실행 보장(0건이면 패배 → 409).
  const { data: updated } = await admin
    .from("order_claims")
    .update({
      status: "APPROVED",
      confirmed_deduction: confirmedDeduction,
      processed_by: processedBy,
      approved_at: new Date().toISOString(),
    })
    .eq("id", claimId)
    .eq("status", "REQUESTED")
    .select("id")
  if (!updated || updated.length === 0) {
    return { ok: false, error: "이미 처리된 신청입니다", status: 409 }
  }
  await dispatchDecisionEmail(admin, claim, "approved", {
    deductionAmount: confirmedDeduction,
  })
  return { ok: true }
}

export const rejectClaim = async (
  claimId: string,
  rejectedReason: string,
  processedBy: string
): Promise<ClaimResult> => {
  const admin = createAdminClient()
  const { data: claim } = await admin
    .from("order_claims")
    .select("*")
    .eq("id", claimId)
    .single()
  if (!claim) return { ok: false, error: "클레임을 찾을 수 없습니다", status: 404 }
  if (claim.status !== "REQUESTED") {
    return { ok: false, error: "접수 상태에서만 거절할 수 있습니다", status: 409 }
  }
  if (!rejectedReason.trim()) {
    return { ok: false, error: "거절 사유를 입력해주세요", status: 400 }
  }
  const { data: updated } = await admin
    .from("order_claims")
    .update({
      status: "REJECTED",
      rejected_reason: rejectedReason.trim(),
      processed_by: processedBy,
    })
    .eq("id", claimId)
    .eq("status", "REQUESTED")
    .select("id")
  if (!updated || updated.length === 0) {
    return { ok: false, error: "이미 처리된 신청입니다", status: 409 }
  }
  // orders.status 원복 (신청 시 기록한 prev_order_status) — claim 전이 성공 후에만.
  await admin
    .from("orders")
    .update({ status: claim.prev_order_status })
    .eq("id", claim.order_id)
  await dispatchDecisionEmail(admin, claim, "rejected", {
    rejectedReason: rejectedReason.trim(),
  })
  return { ok: true }
}

export const markClaimCollected = async (
  claimId: string,
  processedBy: string
): Promise<ClaimResult> => {
  const admin = createAdminClient()
  const { data: claim } = await admin
    .from("order_claims")
    .select("status")
    .eq("id", claimId)
    .single()
  if (!claim) return { ok: false, error: "클레임을 찾을 수 없습니다", status: 404 }
  if (claim.status !== "APPROVED") {
    return { ok: false, error: "승인 상태에서만 회수 완료 처리할 수 있습니다", status: 409 }
  }
  const { data: updated } = await admin
    .from("order_claims")
    .update({
      status: "COLLECTED",
      collected_at: new Date().toISOString(),
      processed_by: processedBy,
    })
    .eq("id", claimId)
    .eq("status", "APPROVED")
    .select("id")
  if (!updated || updated.length === 0) {
    return { ok: false, error: "이미 처리된 신청입니다", status: 409 }
  }
  return { ok: true }
}

// 반품 환불 (spec §3-3): ① 가드+금액계산 ② Toss 부분취소 선기록 ③ RPC ④ 메일.
// 재시도 안전: Toss 성공 후 RPC 실패 시 claim은 COLLECTED+idempotency_key 잔존 → 재호출 시 Toss skip.
export const executeReturnRefund = async (
  claimId: string,
  processedBy: string
): Promise<ClaimResult> => {
  const admin = createAdminClient()
  const { data: claim } = await admin
    .from("order_claims")
    .select("*")
    .eq("id", claimId)
    .single()
  if (!claim) return { ok: false, error: "클레임을 찾을 수 없습니다", status: 404 }
  if (claim.type !== "RETURN") {
    return { ok: false, error: "반품 클레임이 아닙니다", status: 400 }
  }
  if (claim.status !== "COLLECTED") {
    return { ok: false, error: "회수 완료 상태에서만 환불할 수 있습니다", status: 409 }
  }

  const { data: order } = await admin
    .from("orders")
    .select("paid_amount")
    .eq("id", claim.order_id)
    .single()
  if (!order) return { ok: false, error: "주문을 찾을 수 없습니다", status: 404 }

  const deduction = claim.confirmed_deduction ?? claim.proposed_deduction
  const refundAmount = Math.max(0, order.paid_amount - deduction)

  // ② Toss 부분취소 (멱등키 미존재 시에만 — 재시도 시 중복 취소 방지)
  // ⚠️ 경합 주의(reorder 금지): Toss 취소(②)가 RPC의 payments.status 기록(③)보다 먼저 일어난다.
  //   이 sub-second 윈도우에 CANCEL_STATUS_CHANGED webhook이 도착하면 payments.status가 아직 DONE이라
  //   webhook이 외부발로 분기한다(부분→partial_manual warning, 전액→cancelOrder 400→500→Toss 재시도).
  //   ③ RPC가 payments.status를 CANCELLED/PARTIAL_CANCELLED로 기록한 뒤 재시도는 webhook 시나리오1 no-op으로 self-heal.
  //   ②③ 순서를 바꾸면 Toss 성공 후 DB 미기록 gap(회계 불일치)이 생기므로 이 순서를 유지할 것.
  if (!claim.toss_cancel_idempotency_key) {
    const { data: payment } = await admin
      .from("payments")
      .select("payment_key")
      .eq("order_id", claim.order_id)
      .eq("status", "DONE")
      .single()
    if (payment?.payment_key) {
      const idempotencyKey = `claim-return-${claimId}`
      const cancelRes = await tossCancel(payment.payment_key, {
        cancelReason: "반품 환불",
        cancelAmount: refundAmount,
        idempotencyKey,
      })
      if (!cancelRes.ok) {
        return { ok: false, error: cancelRes.error, status: 502 }
      }
      // 선기록: 성공한 Toss를 claim에 박아 RPC 실패 후 재시도 시 Toss를 건너뛴다.
      await admin
        .from("order_claims")
        .update({
          toss_cancel_idempotency_key: idempotencyKey,
          toss_cancel_response: cancelRes.raw as Json,
        })
        .eq("id", claimId)
    }
  }

  // ③ 단일 트랜잭션 RPC
  const { error: rpcErr } = await admin.rpc("process_return_refund", {
    p_claim_id: claimId,
    p_refund_amount: refundAmount,
    p_processed_by: processedBy,
  })
  if (rpcErr) {
    return { ok: false, error: `환불 처리에 실패했습니다: ${rpcErr.message}`, status: 500 }
  }

  // ④ 환불완료 메일 (fire-and-forget)
  const ctx = await loadOrderEmailCtx(admin, claim.order_id)
  if (ctx) {
    const method = paymentMethodOf(ctx.order.payments)
    sendRefundCompleted({
      to: ctx.email,
      customerName: ctx.order.recipient,
      orderNo: ctx.order.order_no,
      refundedDate: formatKST(new Date()),
      refundAmount,
      paymentMethod: getPaymentMethodLabel(method),
      refundEta: getRefundEta(method),
      items: mapItems(ctx.order.order_items ?? []),
      orderDetailUrl: getOrderDetailUrl(claim.order_id),
      context: { claimId, orderId: claim.order_id },
    })
  }
  return { ok: true }
}

// 교환 재발송 (spec §3-4): process_exchange_reship RPC + ShippingStarted 메일.
export const exchangeReship = async (
  claimId: string,
  tracking: string,
  courier: string,
  processedBy: string
): Promise<ClaimResult> => {
  const admin = createAdminClient()
  const { data: claim } = await admin
    .from("order_claims")
    .select("status, type, order_id")
    .eq("id", claimId)
    .single()
  if (!claim) return { ok: false, error: "클레임을 찾을 수 없습니다", status: 404 }
  if (claim.type !== "EXCHANGE") {
    return { ok: false, error: "교환 클레임이 아닙니다", status: 400 }
  }
  if (claim.status !== "COLLECTED") {
    return { ok: false, error: "회수 완료 상태에서만 재발송할 수 있습니다", status: 409 }
  }
  if (!tracking.trim() || !courier.trim()) {
    return { ok: false, error: "송장번호와 택배사를 입력해주세요", status: 400 }
  }

  const { error: rpcErr } = await admin.rpc("process_exchange_reship", {
    p_claim_id: claimId,
    p_tracking: tracking.trim(),
    p_courier: courier.trim(),
  })
  if (rpcErr) {
    return { ok: false, error: `재발송 처리에 실패했습니다: ${rpcErr.message}`, status: 500 }
  }
  await admin.from("order_claims").update({ processed_by: processedBy }).eq("id", claimId)

  const ctx = await loadOrderEmailCtx(admin, claim.order_id)
  if (ctx) {
    sendShippingStarted({
      to: ctx.email,
      customerName: ctx.order.recipient,
      orderNo: ctx.order.order_no,
      shippedDate: formatKST(new Date()),
      courierName: courier.trim(),
      trackingNumber: tracking.trim(),
      trackingUrl: buildTrackingUrl(courier.trim(), tracking.trim()) ?? "",
      shipping: {
        recipient: ctx.order.recipient,
        phone: ctx.order.recipient_phone,
        postalCode: ctx.order.zipcode,
        address: ctx.order.address1,
        addressDetail: ctx.order.address2 ?? undefined,
      },
      orderDetailUrl: getOrderDetailUrl(claim.order_id),
      context: { claimId, orderId: claim.order_id },
    })
  }
  return { ok: true }
}

export const completeExchange = async (
  claimId: string,
  processedBy: string
): Promise<ClaimResult> => {
  const admin = createAdminClient()
  const { data: claim } = await admin
    .from("order_claims")
    .select("status, order_id")
    .eq("id", claimId)
    .single()
  if (!claim) return { ok: false, error: "클레임을 찾을 수 없습니다", status: 404 }
  if (claim.status !== "RESHIPPED") {
    return { ok: false, error: "재발송 상태에서만 교환 완료 처리할 수 있습니다", status: 409 }
  }
  const { data: updated } = await admin
    .from("order_claims")
    .update({
      status: "COMPLETED",
      processed_by: processedBy,
      completed_at: new Date().toISOString(),
    })
    .eq("id", claimId)
    .eq("status", "RESHIPPED")
    .select("id")
  if (!updated || updated.length === 0) {
    return { ok: false, error: "이미 처리된 신청입니다", status: 409 }
  }
  await admin
    .from("orders")
    .update({ status: claimTerminalOrderStatus("EXCHANGE") })
    .eq("id", claim.order_id)
  return { ok: true }
}
