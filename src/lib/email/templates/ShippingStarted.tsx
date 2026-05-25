import {
  Button,
  Heading,
  Link,
  Section,
  Text,
} from "@react-email/components"

import { emailFonts, emailTokens } from "../tokens"
import { Layout } from "./Layout"

export type ShippingStartedAddress = {
  recipient: string
  phone: string
  postalCode: string
  address: string
  addressDetail?: string
}

export type ShippingStartedProps = {
  customerName: string
  /** display용 주문번호 (예: "20260524-000123") */
  orderNo: string
  /** KST 포맷팅된 출고일시 */
  shippedDate: string
  /** display용 택배사명 (예: "CJ대한통운") */
  courierName: string
  trackingNumber: string
  /** 택배사 공식 추적 페이지 deep link (호출부에서 매핑) */
  trackingUrl: string
  shipping: ShippingStartedAddress
  /** 마이페이지 주문 상세 절대 URL */
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
  width: "72px",
}

const shippingBlock = {
  fontSize: "14px",
  lineHeight: 1.6,
  color: emailTokens.foreground,
  margin: "8px 0 0",
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

const secondaryLinkSection = {
  textAlign: "center" as const,
  margin: "4px 0 0",
}

const secondaryLink = {
  fontSize: "13px",
  color: emailTokens.muted,
  textDecoration: "underline",
}

export const ShippingStarted = (props: ShippingStartedProps) => {
  const {
    customerName,
    orderNo,
    shippedDate,
    courierName,
    trackingNumber,
    trackingUrl,
    shipping,
    orderDetailUrl,
  } = props

  const preheader = "상품이 발송되었습니다. 배송 조회를 확인해주세요."

  return (
    <Layout preheader={preheader}>
      <Heading as="h1" style={heading}>
        상품이 출고되었습니다
      </Heading>
      <Text style={lead}>
        {customerName}님의 주문이 발송되었습니다. 아래 송장번호로 배송 조회가
        가능합니다.
      </Text>

      <Section style={infoBox}>
        <Text style={infoRow}>
          <span style={infoLabel}>주문번호</span>
          {orderNo}
        </Text>
        <Text style={infoRow}>
          <span style={infoLabel}>출고일자</span>
          {shippedDate}
        </Text>
        <Text style={infoRow}>
          <span style={infoLabel}>택배사</span>
          {courierName}
        </Text>
        <Text style={infoRow}>
          <span style={infoLabel}>송장번호</span>
          {trackingNumber}
        </Text>
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

      <Section style={ctaSection}>
        <Button href={trackingUrl} style={cta}>
          배송 조회하기
        </Button>
      </Section>
      <Section style={secondaryLinkSection}>
        <Link href={orderDetailUrl} style={secondaryLink}>
          주문 상세 보기
        </Link>
      </Section>
    </Layout>
  )
}

export default ShippingStarted
