import * as Sentry from "@sentry/nextjs"

import { createAdminClient } from "@/lib/supabase/admin"

// 호출부 ↔ 템플릿 사이 매핑 헬퍼.
// 템플릿은 dumb (props 받아서 그대로 렌더), 도메인 변환은 본 파일에 집중.
// 송장 추적 URL은 src/lib/order/tracking-url.ts buildTrackingUrl 기존 SSOT 재사용 (별도 매핑 X).

// payments.method ENUM (001_initial_schema.sql:258)
export type PaymentMethodDb =
  | "CARD"
  | "TRANSFER"
  | "VIRTUAL_ACCOUNT"
  | "KAKAOPAY"
  | "NAVERPAY"
  | "TOSSPAY"

const PAYMENT_METHOD_LABELS: Record<PaymentMethodDb, string> = {
  CARD: "신용카드",
  TRANSFER: "계좌이체",
  VIRTUAL_ACCOUNT: "가상계좌",
  KAKAOPAY: "카카오페이",
  NAVERPAY: "네이버페이",
  TOSSPAY: "토스페이",
}

// 한국 PG사 표준 환불 입금 시기 (보수적 매핑).
// 운영 실데이터 기반 조정은 P2-40 백로그.
const REFUND_ETA: Record<PaymentMethodDb, string> = {
  CARD: "3~7 영업일",
  TRANSFER: "환불 계좌 등록 후 1~3 영업일",
  VIRTUAL_ACCOUNT: "환불 계좌 등록 후 1~3 영업일",
  KAKAOPAY: "즉시~1 영업일",
  NAVERPAY: "즉시~1 영업일",
  TOSSPAY: "즉시~1 영업일",
}

const FALLBACK_LABEL = "결제 완료"
const FALLBACK_ETA = "처리 완료"

const isKnownPaymentMethod = (m: string): m is PaymentMethodDb =>
  m in PAYMENT_METHOD_LABELS

export const getPaymentMethodLabel = (method: string | null | undefined): string => {
  if (!method) return FALLBACK_LABEL
  return isKnownPaymentMethod(method) ? PAYMENT_METHOD_LABELS[method] : FALLBACK_LABEL
}

export const getRefundEta = (method: string | null | undefined): string => {
  if (!method) return FALLBACK_ETA
  return isKnownPaymentMethod(method) ? REFUND_ETA[method] : FALLBACK_ETA
}

// 사이트 URL 단일 진입점 — sitemap.ts / layout.tsx / robots.ts 선례와 동일 fallback.
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"

export const getOrderDetailUrl = (orderId: string): string =>
  `${SITE_URL}/mypage/orders/${orderId}`

// 한국 시간 포맷 — dayjs/plugin/timezone 도입 회피, Intl.DateTimeFormat 사용.
// 입력: ISO string (TIMESTAMPTZ from Postgres) 또는 Date
// 출력: "YYYY-MM-DD HH:mm" (KST)
const KST_FORMATTER = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
})

export const formatKST = (input: string | Date): string => {
  const date = typeof input === "string" ? new Date(input) : input
  const parts = KST_FORMATTER.formatToParts(date)
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? ""
  // ko-KR formatToParts는 "2026.05.24" 형태로 separator를 "."로 반환 → 명시적으로 재조립.
  return `${get("year")}-${get("month")}-${get("day")} ${get("hour")}:${get("minute")}`
}

// 사용자 이메일 조회 — orders.user_id NOT NULL + profiles.email NOT NULL schema에 따라 단순화.
// admin.auth.admin.getUserById 대신 profiles 1회 SELECT (RTT 절약).
// 게스트 주문은 schema-level 차단 (001_initial_schema.sql:195).
export const resolveUserEmail = async (userId: string): Promise<string | null> => {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from("profiles")
    .select("email")
    .eq("id", userId)
    .single()

  if (error || !data) {
    Sentry.captureException(error ?? new Error("Profile not found"), {
      level: "warning",
      tags: { type: "email", event: "user_resolve_failed" },
      extra: { userId },
    })
    return null
  }
  return data.email ?? null
}
