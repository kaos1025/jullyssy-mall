import { ImageResponse } from "next/og"

export const runtime = "edge"
export const alt = "쥴리씨 여성의류 쇼핑몰"
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

export default async function Image() {
  const fontData = await fetch(
    "https://cdn.jsdelivr.net/fontsource/fonts/noto-sans-kr@latest/korean-700-normal.woff"
  ).then((res) => res.arrayBuffer())

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background:
            "linear-gradient(135deg, #FFF7ED 0%, #FFEDD5 50%, #FED7AA 100%)",
          fontFamily: "Noto Sans KR",
        }}
      >
        <div style={{ fontSize: 72, fontWeight: 700, color: "#F97316" }}>
          쥴리씨
        </div>
        <div
          style={{
            fontSize: 28,
            fontWeight: 700,
            color: "#78716C",
            marginTop: 16,
          }}
        >
          JULLYSSY
        </div>
        <div style={{ fontSize: 24, color: "#A8A29E", marginTop: 32 }}>
          20~40대 여성을 위한 트렌디한 의류 쇼핑몰
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        {
          name: "Noto Sans KR",
          data: fontData,
          style: "normal",
          weight: 700,
        },
      ],
    },
  )
}
