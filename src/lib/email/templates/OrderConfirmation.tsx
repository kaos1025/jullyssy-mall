import {
  Button,
  Heading,
  Section,
  Text,
} from "@react-email/components"

import { emailFonts, emailTokens } from "../tokens"
import { Layout } from "./Layout"

export type OrderConfirmationItem = {
  productName: string
  optionName?: string
  quantity: number
  /** 단가 (원, int) */
  priceEach: number
}

export type OrderConfirmationShipping = {
  recipient: string
  phone: string
  postalCode: string
  address: string
  addressDetail?: string
  /** 배송 메모 — 있을 때만 렌더 */
  message?: string
}

export type OrderConfirmationProps = {
  customerName: string
  /** display용 주문번호 (예: "20260524-000123") */
  orderNo: string
  /** KST 포맷팅된 주문일시 (서버에서 가공) */
  orderDate: string
  items: OrderConfirmationItem[]
  subtotal: number
  shippingFee: number
  /** 쿠폰/포인트 합계 (양수, 표시 시 "-" 부호 prefix) */
  discount?: number
  total: number
  /** display용 결제수단 (예: "카카오페이", "신용카드 (신한)") */
  paymentMethod: string
  shipping: OrderConfirmationShipping
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

const infoBox = {
  border: `1px solid ${emailTokens.border}`,
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
  width: "72px",
}

const itemBlock = {
  padding: "12px 0",
  borderTop: `1px solid ${emailTokens.border}`,
}

const itemBlockFirst = {
  padding: "12px 0",
  borderTop: `1px solid ${emailTokens.border}`,
}

const itemBlockLast = {
  padding: "12px 0",
  borderTop: `1px solid ${emailTokens.border}`,
  borderBottom: `1px solid ${emailTokens.border}`,
}

const itemTable = {
  width: "100%",
  borderCollapse: "collapse" as const,
}

const itemNameCell = {
  fontSize: "14px",
  color: emailTokens.foreground,
  verticalAlign: "top" as const,
  padding: 0,
}

const itemPriceCell = {
  fontSize: "14px",
  color: emailTokens.foreground,
  textAlign: "right" as const,
  whiteSpace: "nowrap" as const,
  verticalAlign: "top" as const,
  padding: 0,
}

const itemOption = {
  fontSize: "12px",
  color: emailTokens.muted,
  margin: "4px 0 0",
}

const summaryBox = {
  backgroundColor: emailTokens.cardBg,
  borderRadius: "8px",
  padding: "16px 20px",
  margin: "8px 0 0",
}

const summaryTable = {
  width: "100%",
  borderCollapse: "collapse" as const,
}

const summaryRow = {
  fontSize: "14px",
  color: emailTokens.foreground,
  padding: "4px 0",
}

const summaryLabel = {
  ...summaryRow,
  textAlign: "left" as const,
}

const summaryValue = {
  ...summaryRow,
  textAlign: "right" as const,
  whiteSpace: "nowrap" as const,
}

const summaryDivider = {
  borderTop: `1px solid ${emailTokens.border}`,
  margin: "8px 0",
}

const totalLabel = {
  ...summaryLabel,
  fontWeight: 700,
}

const totalValue = {
  ...summaryValue,
  fontWeight: 700,
  fontSize: "16px",
  color: emailTokens.primary,
}

const shippingBlock = {
  fontSize: "14px",
  lineHeight: 1.6,
  color: emailTokens.foreground,
  margin: "8px 0 0",
}

const shippingMemo = {
  ...shippingBlock,
  color: emailTokens.muted,
  margin: "4px 0 0",
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
  margin: "32px 0 8px",
}

export const OrderConfirmation = (props: OrderConfirmationProps) => {
  const {
    customerName,
    orderNo,
    orderDate,
    items,
    subtotal,
    shippingFee,
    discount,
    total,
    paymentMethod,
    shipping,
    orderDetailUrl,
  } = props

  const preheader = `${customerName}님의 주문 ${orderNo} 접수 완료 — 총 ${krw(total)}`

  return (
    <Layout preheader={preheader}>
      <Heading as="h1" style={heading}>
        주문해주셔서 감사합니다
      </Heading>
      <Text style={lead}>
        {customerName}님의 주문이 정상적으로 접수되었습니다. 결제 확인 후 상품
        준비가 시작됩니다.
      </Text>

      <Section style={infoBox}>
        <Text style={infoRow}>
          <span style={infoLabel}>주문번호</span>
          {orderNo}
        </Text>
        <Text style={infoRow}>
          <span style={infoLabel}>주문일자</span>
          {orderDate}
        </Text>
      </Section>

      <Heading as="h2" style={sectionHeading}>
        주문 상품
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
            <table style={itemTable} cellPadding={0} cellSpacing={0}>
              <tbody>
                <tr>
                  <td style={itemNameCell}>{item.productName}</td>
                  <td style={itemPriceCell}>
                    {krw(item.priceEach * item.quantity)}
                  </td>
                </tr>
              </tbody>
            </table>
            <Text style={itemOption}>
              {item.optionName ? `${item.optionName} · ` : ""}
              {item.quantity}개
              {item.quantity > 1 ? ` (각 ${krw(item.priceEach)})` : ""}
            </Text>
          </Section>
        )
      })}

      <Heading as="h2" style={sectionHeading}>
        결제 정보
      </Heading>
      <Section style={summaryBox}>
        <table style={summaryTable} cellPadding={0} cellSpacing={0}>
          <tbody>
            <tr>
              <td style={summaryLabel}>상품금액</td>
              <td style={summaryValue}>{krw(subtotal)}</td>
            </tr>
            <tr>
              <td style={summaryLabel}>배송비</td>
              <td style={summaryValue}>
                {shippingFee === 0 ? "무료배송" : krw(shippingFee)}
              </td>
            </tr>
            {discount && discount > 0 ? (
              <tr>
                <td style={summaryLabel}>할인</td>
                <td style={summaryValue}>-{krw(discount)}</td>
              </tr>
            ) : null}
          </tbody>
        </table>
        <div style={summaryDivider} />
        <table style={summaryTable} cellPadding={0} cellSpacing={0}>
          <tbody>
            <tr>
              <td style={totalLabel}>총 결제금액</td>
              <td style={totalValue}>{krw(total)}</td>
            </tr>
            <tr>
              <td style={summaryLabel}>결제수단</td>
              <td style={summaryValue}>{paymentMethod}</td>
            </tr>
          </tbody>
        </table>
      </Section>

      <Heading as="h2" style={sectionHeading}>
        배송지
      </Heading>
      <Text style={shippingBlock}>
        {shipping.recipient} · {shipping.phone}
      </Text>
      <Text style={shippingBlock}>
        ({shipping.postalCode}) {shipping.address}
        {shipping.addressDetail ? ` ${shipping.addressDetail}` : ""}
      </Text>
      {shipping.message ? (
        <Text style={shippingMemo}>배송 메모: {shipping.message}</Text>
      ) : null}

      <Section style={ctaSection}>
        <Button href={orderDetailUrl} style={cta}>
          주문 상세 보기
        </Button>
      </Section>
    </Layout>
  )
}

export default OrderConfirmation
