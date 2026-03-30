import type { Metadata } from "next"
import "./globals.css"
import { Toaster } from "@/components/ui/toaster"

export const metadata: Metadata = {
  title: "쥴리씨 | 여성의류",
  description: "트렌디한 여성의류 온라인 스토어",
  openGraph: {
    locale: "ko_KR",
    title: "쥴리씨 | 여성의류",
    description: "트렌디한 여성의류 온라인 스토어",
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
