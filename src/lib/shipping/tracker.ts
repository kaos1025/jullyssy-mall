// 송장 추적 status 폴링 어댑터 SSOT.
//
// 표시용 buildTrackingUrl(lib/order/tracking-url.ts, 네이버 검색 링크)과는 별개 concern:
// 이쪽은 사람이 클릭하는 링크가 아니라 프로그램이 "배송완료 여부를 *쿼리*"하기 위한 것이다.
// A→C 전환(Sweet Tracker 무료 → 택배사 공식 API) 대비해 인터페이스로 추상화한다.
// 현재 구현체는 SweetTrackerAdapter 1종.

export interface TrackingResult {
  delivered: boolean
  /** 배송완료 시각(추적 API 기준). 파싱 불가 시 null → 호출측에서 now() fallback. */
  deliveredAt: Date | null
  raw?: unknown
}

export interface ShippingTracker {
  /**
   * courier: 우리 시스템의 자유텍스트 라벨(COURIER_SUGGESTIONS).
   * 매핑 불가 택배사는 UnsupportedCourierError, 호출/파싱 실패는 TrackerApiError를 던진다.
   * (폴링측에서 건별 격리: Unsupported는 조용히 skip, TrackerApiError는 Sentry.)
   */
  fetchStatus(courier: string, trackingNo: string): Promise<TrackingResult>
}

// 우리 courier 자유텍스트 라벨 → Sweet Tracker t_code.
// COURIER-ENUM-SSOT-1 흡수: "자동완료 지원 택배사 ↔ 코드"의 단일 진실.
// 매핑은 어댑터 종속이다(택배사 공식 API로 A→C 전환 시 코드 체계가 달라짐).
// 코드값은 Sweet Tracker companylist 기준(01 우체국 / 04 CJ / 05 한진 / 08 롯데).
const SWEET_TRACKER_CODE: Record<string, string> = {
  CJ대한통운: "04",
  롯데택배: "08",
  한진택배: "05",
  우체국택배: "01",
}

/** 매핑 불가(미지원 택배사/자유텍스트 변형). 시스템 오류가 아니라 폴링 대상 제외 신호. */
export class UnsupportedCourierError extends Error {
  constructor(courier: string) {
    super(`자동완료 미지원 택배사: ${courier}`)
    this.name = "UnsupportedCourierError"
  }
}

/** 추적 API 호출/파싱/에러응답. 폴링 건별 격리 후 Sentry 대상. */
export class TrackerApiError extends Error {
  constructor(
    message: string,
    readonly detail?: unknown
  ) {
    super(message)
    this.name = "TrackerApiError"
  }
}

export const resolveSweetTrackerCode = (courier: string): string | null =>
  SWEET_TRACKER_CODE[courier.trim()] ?? null

const SWEET_TRACKER_ENDPOINT =
  "https://info.sweettracker.co.kr/api/v1/trackingInfo"
const FETCH_TIMEOUT_MS = 8_000

// Sweet Tracker 완료 시각은 KST(Asia/Seoul) 문자열 "YYYY-MM-DD HH:mm:ss".
// Vercel(UTC) 런타임에서 로컬 파싱하면 9시간 오차 → 명시적 +09:00 부착 후 파싱.
const parseKstTimeString = (s: unknown): Date | null => {
  if (typeof s !== "string" || !s.trim()) return null
  const d = new Date(s.trim().replace(" ", "T") + "+09:00")
  return Number.isNaN(d.getTime()) ? null : d
}

class SweetTrackerAdapter implements ShippingTracker {
  async fetchStatus(
    courier: string,
    trackingNo: string
  ): Promise<TrackingResult> {
    // lazy: 모듈 로드 시점이 아니라 호출 시점에 키 확인(Resend lazy-init 결).
    const apiKey = process.env.SWEET_TRACKER_API_KEY
    if (!apiKey) throw new TrackerApiError("SWEET_TRACKER_API_KEY 미설정")

    const code = resolveSweetTrackerCode(courier)
    if (!code) throw new UnsupportedCourierError(courier)

    const url = `${SWEET_TRACKER_ENDPOINT}?t_key=${encodeURIComponent(
      apiKey
    )}&t_code=${code}&t_invoice=${encodeURIComponent(trackingNo)}`

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
    let data: Record<string, unknown>
    try {
      const res = await fetch(url, { signal: controller.signal })
      if (!res.ok) throw new TrackerApiError(`HTTP ${res.status}`)
      data = (await res.json()) as Record<string, unknown>
    } catch (err) {
      if (err instanceof TrackerApiError) throw err
      throw new TrackerApiError("Sweet Tracker 호출 실패", err)
    } finally {
      clearTimeout(timer)
    }

    // 에러 응답은 추적 필드가 없고 {status:false, code, msg} 형태.
    // 정상 응답은 completeYN/level/trackingDetails 중 하나 이상을 가진다.
    const looksValid =
      "completeYN" in data || "level" in data || "trackingDetails" in data
    if (data.status === false || !looksValid) {
      throw new TrackerApiError(
        `Sweet Tracker 오류: ${String(data.msg ?? data.code ?? "unknown")}`
      )
    }

    const delivered =
      data.completeYN === "Y" ||
      data.complete === true ||
      Number(data.level) >= 6

    const lastDetail = data.lastDetail as { timeString?: unknown } | undefined
    return {
      delivered,
      deliveredAt: delivered ? parseKstTimeString(lastDetail?.timeString) : null,
      raw: data,
    }
  }
}

let cached: ShippingTracker | null = null

/** A→C 전환 지점: 향후 CjApiAdapter 등으로 교체. */
export const getShippingTracker = (): ShippingTracker => {
  if (!cached) cached = new SweetTrackerAdapter()
  return cached
}
