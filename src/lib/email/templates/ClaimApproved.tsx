import {
  Button,
  Heading,
  Section,
  Text,
} from "@react-email/components"

import { emailFonts, emailTokens } from "../tokens"
import { Layout } from "./Layout"

export type ClaimApprovedItem = {
  productName: string
  optionName?: string
  quantity: number
}

export type ClaimApprovedProps = {
  customerName: string
  orderNo: string
  /** 이미 한국어로 변환된 "반품" 또는 "교환" */
  claimType: string
  /** 차감 배송비(원). 0이면 "없음"으로 표기 */
  deductionAmount: number
  /** 회수 주소 */
  pickupAddress: string
  items: ClaimApprovedItem[]
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

export const ClaimApproved = (props: ClaimApprovedProps) => {
  const {
    customerName,
    orderNo,
    claimType,
    deductionAmount,
    pickupAddress,
    items,
    orderDetailUrl,
  } = props

  const preheader = `${claimType} 신청이 승인되었습니다. 회수 안내를 확인해주세요.`

  return (
    <Layout preheader={preheader}>
      <Heading as="h1" style={heading}>
        {claimType} 신청이 승인되었습니다
      </Heading>
      <Text style={lead}>
        {customerName}님의 {claimType} 신청이 승인되었습니다.
      </Text>

      <Section style={refundBox}>
        <Text style={infoRow}>
          <span style={infoLabel}>주문번호</span>
          {orderNo}
        </Text>
        <Text style={infoRow}>
          <span style={infoLabel}>신청유형</span>
          {claimType}
        </Text>
        <Text style={infoRow}>
          <span style={infoLabel}>차감 배송비</span>
          {deductionAmount === 0 ? "없음" : krw(deductionAmount)}
        </Text>
        <Text style={infoRow}>
          <span style={infoLabel}>회수 주소</span>
          {pickupAddress}
        </Text>
      </Section>

      <Heading as="h2" style={sectionHeading}>
        {claimType} 상품
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
        수거 기사님이 등록된 회수 주소로 방문할 예정입니다. 상품을 준비해 주세요.
      </Text>

      <Section style={ctaSection}>
        <Button href={orderDetailUrl} style={cta}>
          주문 상세 보기
        </Button>
      </Section>
    </Layout>
  )
}

export default ClaimApproved
