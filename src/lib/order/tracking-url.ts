// 송장 추적 URL 빌더 SSOT.
// 네이버 검색 통합 URL을 사용하는 이유: 택배사별 trace URL이 자주 깨지고(우체국/롯데는 종종
// POST 요구), 한진 등 미지원 택배사 확장 시 매번 핸들러 추가가 필요. 네이버는 "{택배사} {송장번호}"
// 자유 텍스트 검색만으로도 결과 페이지 상단에 통합 추적 위젯을 노출하므로 유지비가 가장 낮다.
export const buildTrackingUrl = (
  courier: string | null | undefined,
  trackingNo: string | null | undefined
): string | null => {
  if (!trackingNo) return null
  const query = courier ? `${courier} ${trackingNo}` : trackingNo
  return `https://search.naver.com/search.naver?query=${encodeURIComponent(query)}`
}
