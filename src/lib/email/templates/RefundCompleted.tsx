import {
  Button,
  Heading,
  Section,
  Text,
} from "@react-email/components"

import { emailFonts, emailTokens } from "../tokens"
import { Layout } from "./Layout"

export type RefundCompletedItem = {
  productName: string
  optionName?: string
  quantity: number
}

export type RefundCompletedProps = {
  customerName: string
  /** display용 주문번호 */
  orderNo: string
  /** KST 포맷팅된 환불 완료 일시 */
  refundedDate: string
  /** 환불 금액 (원, int) */
  refundAmount: number
  /** display용 원 결제수단 (예: "신용카드", "카카오페이", "네이버페이") */
  paymentMethod: string
  /**
   * 입금 예상 기간 — 호출부에서 paymentMethod 기반 매핑.
   *   - 신용카드: "3~7 영업일"
   *   - 카카오페이/네이버페이: "즉시~1 영업일"
   *   - 계좌이체: "환불 계좌 등록 후 1~3 영업일"
   */
  refundEta: string
  items: RefundCompletedItem[]
  /** 마이페이지 주문 상세 절대 URL */
  orderDetailUrl: string
}

const krw = (n: number) => `₩${n.toLocaleString("ko-KR")}`

const heading = {
  fontSize: "24px",
  fontWeight: 700,
  lineHeight: 1.3,
  color: emailTokens.foreground,
  margin: "0 0 12px",
}

const lead = {
  fontSize: "14px",
  lineHeight: 1.6,
  color: emailTokens.foreground,
  margin: "0 0 24px",
}

const sectionHeading = {
  fontSize: "18px",
  fontWeight: 700,
  lineHeight: 1.3,
  color: emailTokens.foreground,
  margin: "32px 0 12px",
}

const refundBox = {
  backgroundColor: emailTokens.cardBg,
  borderRadius: "8px",
  padding: "16px 20px",
  margin: "0 0 12px",
}

const infoRow = {
  fontSize: "14px",
  lineHeight: 1.6,
  margin: "2px 0",
  color: emailTokens.foreground,
}

const infoLabel = {
  color: emailTokens.muted,
  display: "inline-block",
  width: "88px",
}

const amountHighlight = {
  fontSize: "16px",
  fontWeight: 700,
  color: emailTokens.primary,
}

const itemBlockFirst = {
  padding: "12px 0",
  borderTop: `1px solid ${emailTokens.border}`,
}

const itemBlock = {
  padding: "12px 0",
  borderTop: `1px solid ${emailTokens.border}`,
}

const itemBlockLast = {
  padding: "12px 0",
  borderTop: `1px solid ${emailTokens.border}`,
  borderBottom: `1px solid ${emailTokens.border}`,
}

const itemName = {
  fontSize: "14px",
  color: emailTokens.foreground,
  margin: 0,
}

const itemOption = {
  fontSize: "12px",
  color: emailTokens.muted,
  margin: "4px 0 0",
}

const notice = {
  fontSize: "12px",
  lineHeight: 1.6,
  color: emailTokens.muted,
  margin: "16px 0 0",
}

const cta = {
  display: "inline-block",
  backgroundColor: emailTokens.primary,
  color: emailTokens.primaryFg,
  fontFamily: emailFonts.sans,
  fontWeight: 600,
  fontSize: "14px",
  padding: "12px 32px",
  borderRadius: "8px",
  textDecoration: "none",
}

const ctaSection = {
  textAlign: "center" as const,
  margin: "24px 0 8px",
}

export const RefundCompleted = (props: RefundCompletedProps) => {
  const {
    customerName,
    orderNo,
    refundedDate,
    refundAmount,
    paymentMethod,
    refundEta,
    items,
    orderDetailUrl,
  } = props

  const preheader = "환불이 완료되었습니다. 환불 정보를 확인해주세요."

  return (
    <Layout preheader={preheader}>
      <Heading as="h1" style={heading}>
        환불이 완료되었습니다
      </Heading>
      <Text style={lead}>
        {customerName}님의 환불 요청이 처리되었습니다.
      </Text>

      <Section style={refundBox}>
        <Text style={infoRow}>
          <span style={infoLabel}>주문번호</span>
          {orderNo}
        </Text>
        <Text style={infoRow}>
          <span style={infoLabel}>환불 완료일</span>
          {refundedDate}
        </Text>
        <Text style={infoRow}>
          <span style={infoLabel}>환불 금액</span>
          <span style={amountHighlight}>{krw(refundAmount)}</span>
        </Text>
        <Text style={infoRow}>
          <span style={infoLabel}>환불 수단</span>
          {paymentMethod}
        </Text>
        <Text style={infoRow}>
          <span style={infoLabel}>입금 예상</span>
          {refundEta}
        </Text>
      </Section>

      <Heading as="h2" style={sectionHeading}>
        환불 상품
      </Heading>
      {items.map((item, idx) => {
        const isLast = idx === items.length - 1
        const style = isLast
          ? itemBlockLast
          : idx === 0
            ? itemBlockFirst
            : itemBlock
        return (
          <Section key={`${item.productName}-${idx}`} style={style}>
            <Text style={itemName}>{item.productName}</Text>
            <Text style={itemOption}>
              {item.optionName ? `${item.optionName} · ` : ""}
              {item.quantity}개
            </Text>
          </Section>
        )
      })}

      <Text style={notice}>
        환불 수단별 입금 시기는 카드사/PG사 정책에 따라 다를 수 있습니다.
      </Text>

      <Section style={ctaSection}>
        <Button href={orderDetailUrl} style={cta}>
          주문 상세 보기
        </Button>
      </Section>
    </Layout>
  )
}

export default RefundCompleted
