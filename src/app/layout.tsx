import type { Metadata } from "next"
import "./globals.css"
import { Toaster } from "@/components/ui/toaster"

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"
  ),
  title: {
    default: "쥴리씨 | 20~40대 여성의류 쇼핑몰",
    template: "%s | 쥴리씨 여성의류",
  },
  description:
    "20~40대 여성을 위한 트렌디한 의류 쇼핑몰. 상의, 하의, 아우터, 원피스 등 다양한 여성의류를 합리적인 가격에 만나보세요.",
  keywords: [
    "여성의류",
    "여성쇼핑몰",
    "여성옷",
    "쥴리씨",
    "20대여성의류",
    "30대여성의류",
    "여성의류쇼핑몰",
  ],
  openGraph: {
    type: "website",
    locale: "ko_KR",
    siteName: "쥴리씨",
  },
  twitter: {
    card: "summary_large_image",
  },
  robots: {
    index: true,
    follow: true,
  },
  verification: {
    // 네이버 서치어드바이저 등록 후 추가
    // other: { "naver-site-verification": "인증코드" },
  },
}

const RootLayout = ({
  children,
}: Readonly<{
  children: React.ReactNode
}>) => {
  return (
    <html lang="ko">
      <head>
        <link
          rel="stylesheet"
          as="style"
          crossOrigin="anonymous"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
        />
      </head>
      <body className="font-pretendard antialiased">
        {children}
        <Toaster />
      </body>
    </html>
  )
}

export default RootLayout
