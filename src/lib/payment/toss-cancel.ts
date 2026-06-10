// P1-16 spec v0.2 §3-1: Toss 부분/전액 취소 primitive.
// cancelOrder의 인라인 호출을 대체 + 반품 부분환불(claim 오케스트레이션)에서 재사용.
// 부분취소 시 GET으로 balanceAmount 실조회(저장값 불신, 서버 권위) + cancelAmount 검증,
// Idempotency-Key로 금전 작업 중복 방지. cancelAmount 생략 = 전액(기존 cancelOrder 거동 동일).

const TOSS_PAYMENTS_API = "https://api.tosspayments.com/v1/payments"

export interface TossCancelParams {
  cancelReason: string
  /** 생략 시 전액 취소 (기존 cancelOrder 거동) */
  cancelAmount?: number
  /** 금전 작업 멱등키 — 재시도 중복 취소 방지 */
  idempotencyKey?: string
}

export type TossCancelResult =
  | {
      ok: true
      /** 취소 후 잔여 취소가능액 */
      balanceAmount: number
      /** balanceAmount>0 → 부분, 0 → 전액 */
      paymentStatus: "PARTIAL_CANCELLED" | "CANCELLED"
      raw: unknown
    }
  | { ok: false; error: string; httpStatus: number }

const buildAuthHeader = (): string => {
  const secretKey = process.env.TOSS_SECRET_KEY || ""
  return `Basic ${Buffer.from(`${secretKey}:`).toString("base64")}`
}

export const tossCancel = async (
  paymentKey: string,
  params: TossCancelParams
): Promise<TossCancelResult> => {
  const authHeader = buildAuthHeader()

  // 부분취소: balanceAmount 실조회 후 cancelAmount 검증 (저장값 불신, 서버 권위).
  // 전액(cancelAmount 미지정)은 GET 생략 → 기존 cancelOrder 거동과 동일.
  if (params.cancelAmount != null) {
    const getRes = await fetch(`${TOSS_PAYMENTS_API}/${paymentKey}`, {
      method: "GET",
      headers: { Authorization: authHeader },
    })
    if (!getRes.ok) {
      const e = (await getRes.json().catch(() => ({}))) as { message?: string }
      return {
        ok: false,
        error: e.message || "결제 조회에 실패했습니다",
        httpStatus: getRes.status,
      }
    }
    const payment = (await getRes.json()) as { balanceAmount?: number }
    if (typeof payment.balanceAmount !== "number") {
      return {
        ok: false,
        error: "취소 가능액(balanceAmount)을 확인할 수 없습니다",
        httpStatus: 502,
      }
    }
    if (params.cancelAmount > payment.balanceAmount) {
      return {
        ok: false,
        error: `취소 가능액 초과 (요청 ${params.cancelAmount} > 잔액 ${payment.balanceAmount})`,
        httpStatus: 400,
      }
    }
  }

  const headers: Record<string, string> = {
    Authorization: authHeader,
    "Content-Type": "application/json",
  }
  if (params.idempotencyKey) headers["Idempotency-Key"] = params.idempotencyKey

  const body: Record<string, unknown> = { cancelReason: params.cancelReason }
  if (params.cancelAmount != null) body.cancelAmount = params.cancelAmount

  const res = await fetch(`${TOSS_PAYMENTS_API}/${paymentKey}/cancel`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const e = (await res.json().catch(() => ({}))) as { message?: string }
    return {
      ok: false,
      error: e.message || "결제 취소에 실패했습니다",
      httpStatus: res.status,
    }
  }

  const result = (await res.json()) as { balanceAmount?: number }
  const balanceAmount =
    typeof result.balanceAmount === "number" ? result.balanceAmount : 0
  return {
    ok: true,
    balanceAmount,
    paymentStatus: balanceAmount > 0 ? "PARTIAL_CANCELLED" : "CANCELLED",
    raw: result,
  }
}
