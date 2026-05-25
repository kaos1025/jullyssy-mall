import {
  Body,
  Container,
  Head,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components"
import type { ReactNode } from "react"

import { BUSINESS_INFO } from "@/constants/business"

import { emailFonts, emailTokens } from "../tokens"

export type LayoutProps = {
  /** 메일 클라이언트 inbox preview 텍스트 (필수 — 미지정 시 본문 첫 줄 자동 노출) */
  preheader: string
  children: ReactNode
}

const main = {
  backgroundColor: emailTokens.background,
  fontFamily: emailFonts.sans,
  color: emailTokens.foreground,
  margin: 0,
  padding: "24px 0",
}

const container = {
  backgroundColor: emailTokens.background,
  maxWidth: "600px",
  margin: "0 auto",
  padding: "0 24px",
}

const wordmarkSection = {
  paddingTop: "8px",
  paddingBottom: "24px",
  textAlign: "center" as const,
}

const wordmark = {
  fontFamily: emailFonts.display,
  fontSize: "28px",
  fontWeight: 500,
  letterSpacing: "0.3em",
  color: emailTokens.foreground,
  margin: 0,
}

const hr = {
  borderColor: emailTokens.border,
  borderStyle: "solid",
  borderWidth: "1px 0 0 0",
  margin: "32px 0 16px",
}

const footer = {
  textAlign: "center" as const,
  color: emailTokens.muted,
  fontSize: "12px",
  lineHeight: 1.6,
  marginTop: "8px",
}

const footerLine = {
  color: emailTokens.muted,
  fontSize: "12px",
  lineHeight: 1.6,
  margin: "2px 0",
}

export const Layout = ({ preheader, children }: LayoutProps) => {
  const { customerCenter } = BUSINESS_INFO
  return (
    <Html lang="ko">
      <Head>
        <meta name="color-scheme" content="light only" />
        <meta name="supported-color-schemes" content="light" />
      </Head>
      <Preview>{preheader}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={wordmarkSection}>
            <Text style={wordmark}>JULLYSSY</Text>
          </Section>

          {children}

          <Hr style={hr} />

          <Section style={footer}>
            <Text style={footerLine}>
              {BUSINESS_INFO.companyName} · 대표 {BUSINESS_INFO.representative}
            </Text>
            <Text style={footerLine}>
              사업자등록번호 {BUSINESS_INFO.businessNumber}
            </Text>
            <Text style={footerLine}>
              통신판매업신고 {BUSINESS_INFO.mailOrderNumber}
            </Text>
            <Text style={footerLine}>
              {BUSINESS_INFO.address} {BUSINESS_INFO.addressDetail}
            </Text>
            <Text style={footerLine}>
              고객센터 {customerCenter.phoneDisplay} · {customerCenter.hours}
            </Text>
            <Text style={footerLine}>{customerCenter.email}</Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

export default Layout
