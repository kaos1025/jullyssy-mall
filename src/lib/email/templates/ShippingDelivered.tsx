import {
  Button,
  Heading,
  Section,
  Text,
} from "@react-email/components"

import { emailFonts, emailTokens } from "../tokens"
import { Layout } from "./Layout"

export type ShippingDeliveredItem = {
  productName: string
  optionName?: string
  quantity: number
}

export type ShippingDeliveredProps = {
  customerName: string
  /** display용 주문번호 */
  orderNo: string
  /** KST 포맷팅된 배송 완료 일시 */
  deliveredDate: string
  items: ShippingDeliveredItem[]
  /** 마이페이지 주문 상세 절대 URL (리뷰 진입 hub) */
  orderDetailUrl: string
}

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
  width: "88px",
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

const reviewPrompt = {
  fontSize: "14px",
  lineHeight: 1.6,
  color: emailTokens.foreground,
  margin: "24px 0 4px",
}

const reviewPromptSub = {
  fontSize: "14px",
  lineHeight: 1.6,
  color: emailTokens.muted,
  margin: "0 0 8px",
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
  margin: "16px 0 8px",
}

export const ShippingDelivered = (props: ShippingDeliveredProps) => {
  const { customerName, orderNo, deliveredDate, items, orderDetailUrl } = props

  const preheader = "배송이 완료되었습니다. 상품은 잘 받으셨나요?"

  return (
    <Layout preheader={preheader}>
      <Heading as="h1" style={heading}>
        배송이 완료되었습니다
      </Heading>
      <Text style={lead}>
        {customerName}님의 상품이 도착했습니다. 상품에 이상이 있다면 마이페이지에서
        문의 또는 교환/환불을 신청해주세요.
      </Text>

      <Section style={infoBox}>
        <Text style={infoRow}>
          <span style={infoLabel}>주문번호</span>
          {orderNo}
        </Text>
        <Text style={infoRow}>
          <span style={infoLabel}>배송 완료</span>
          {deliveredDate}
        </Text>
      </Section>

      <Heading as="h2" style={sectionHeading}>
        배송 상품
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

      <Text style={reviewPrompt}>상품이 마음에 드셨나요?</Text>
      <Text style={reviewPromptSub}>
        리뷰를 남겨주시면 다른 고객들에게 큰 도움이 됩니다.
      </Text>

      <Section style={ctaSection}>
        <Button href={orderDetailUrl} style={cta}>
          주문 상세 보기
        </Button>
      </Section>
    </Layout>
  )
}

export default ShippingDelivered
