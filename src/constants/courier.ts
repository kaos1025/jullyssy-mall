export const COURIERS = ["CJ대한통운", "롯데택배", "우체국택배"] as const

export type CourierName = (typeof COURIERS)[number]

export const COURIER_TRACKING_URLS: Record<CourierName, (trackingNo: string) => string> = {
  CJ대한통운: (no) => `https://trace.cjlogistics.com/web/detail.jsp?slipno=${no}`,
  롯데택배: (no) => `https://www.lotteglogis.com/home/reservation/tracking/link498View?InvNo=${no}`,
  우체국택배: (no) => `https://service.epost.go.kr/trace.RetrieveDomRi498.postal?sid1=${no}`,
}
