"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import dayjs from "dayjs"
import {
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  RotateCcw,
  Save,
  ThumbsDown,
  ThumbsUp,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { buildPatternAlt } from "@/lib/seo/main-image-alt"
import type {
  DraftImageAlt,
  SeoDraftDetail,
  SeoDraftListItem,
  SeoDraftListResponse,
} from "@/types/seo"

interface Props {
  initialDrafts: SeoDraftListItem[]
  initialTotal: number
  initialDetail: SeoDraftDetail | null
  perPage: number
}

const META_TITLE_MAX = 60
const META_DESCRIPTION_MAX = 155
const SEARCH_TAGS_MIN = 5
const SEARCH_TAGS_MAX = 10
const ALT_TEXT_MAX = 100

const tagsToInput = (tags: string[] | null): string =>
  (tags ?? []).join(", ")

const inputToTags = (input: string): string[] =>
  input
    .split(",")
    .map((t) => t.trim())
    .filter((t) => t.length > 0)

const buildAltMap = (
  alts: DraftImageAlt[] | null,
): Record<number, string> => {
  const map: Record<number, string> = { 0: "", 1: "", 2: "" }
  ;(alts ?? []).forEach((a) => {
    if (a.image_index >= 0 && a.image_index <= 2) {
      map[a.image_index] = a.alt_text
    }
  })
  return map
}

const SeoDraftsClient = ({
  initialDrafts,
  initialTotal,
  initialDetail,
  perPage,
}: Props) => {
  const { toast } = useToast()
  const [drafts, setDrafts] = useState<SeoDraftListItem[]>(initialDrafts)
  const [total, setTotal] = useState(initialTotal)
  const [page, setPage] = useState(1)
  const [listLoading, setListLoading] = useState(false)

  const [selectedId, setSelectedId] = useState<string | null>(
    initialDetail?.id ?? initialDrafts[0]?.id ?? null,
  )
  const [detail, setDetail] = useState<SeoDraftDetail | null>(initialDetail)
  const [detailLoading, setDetailLoading] = useState(false)

  // DUPLICATE-FETCH-AUDIT-1 (P1): Server에서 initialDetail prefetch — 첫 mount
  // 시 useEffect의 fetchDetail 호출을 1회 skip하여 waterfall 제거.
  // (이후 다른 draft 클릭 / 페이지 이동 시는 client fetch 정상 동작.)
  const skipInitialFetchRef = useRef<boolean>(initialDetail !== null)

  // 편집 상태 (initialDetail 있으면 즉시 prefill)
  const [metaTitle, setMetaTitle] = useState(initialDetail?.meta_title ?? "")
  const [metaDescription, setMetaDescription] = useState(
    initialDetail?.meta_description ?? "",
  )
  const [searchTagsInput, setSearchTagsInput] = useState(
    tagsToInput(initialDetail?.search_tags ?? null),
  )
  const [altTexts, setAltTexts] = useState<Record<number, string>>(
    buildAltMap(initialDetail?.image_alt_texts ?? null),
  )

  const [submitting, setSubmitting] = useState<
    null | "save" | "approve" | "reject" | "regenerate"
  >(null)

  const totalPages = Math.max(1, Math.ceil(total / perPage))

  // 목록 fetch (페이지 변경 시)
  const fetchList = useCallback(
    async (pageNum: number) => {
      setListLoading(true)
      try {
        const offset = (pageNum - 1) * perPage
        const res = await fetch(
          `/api/admin/seo-drafts?limit=${perPage}&offset=${offset}`,
        )
        if (!res.ok) {
          const j = await res.json().catch(() => ({}))
          throw new Error(j.error ?? `HTTP ${res.status}`)
        }
        const data = (await res.json()) as SeoDraftListResponse
        setDrafts(data.drafts)
        setTotal(data.total)
        if (data.drafts.length > 0 && !data.drafts.find((d) => d.id === selectedId)) {
          setSelectedId(data.drafts[0].id)
        }
      } catch (e) {
        toast({
          variant: "destructive",
          title: "목록 조회 실패",
          description: e instanceof Error ? e.message : String(e),
        })
      } finally {
        setListLoading(false)
      }
    },
    [perPage, selectedId, toast],
  )

  // 상세 fetch (선택 변경 시)
  const fetchDetail = useCallback(
    async (id: string) => {
      setDetailLoading(true)
      try {
        const res = await fetch(`/api/admin/seo-drafts/${id}`)
        if (!res.ok) {
          const j = await res.json().catch(() => ({}))
          throw new Error(j.error ?? `HTTP ${res.status}`)
        }
        const data = (await res.json()) as SeoDraftDetail
        setDetail(data)
        setMetaTitle(data.meta_title ?? "")
        setMetaDescription(data.meta_description ?? "")
        setSearchTagsInput(tagsToInput(data.search_tags))
        setAltTexts(buildAltMap(data.image_alt_texts))
      } catch (e) {
        toast({
          variant: "destructive",
          title: "상세 조회 실패",
          description: e instanceof Error ? e.message : String(e),
        })
        setDetail(null)
      } finally {
        setDetailLoading(false)
      }
    },
    [toast],
  )

  useEffect(() => {
    if (skipInitialFetchRef.current) {
      // 첫 mount 시 Server-prefetched initialDetail 사용 — fetch skip.
      skipInitialFetchRef.current = false
      return
    }
    if (selectedId) {
      fetchDetail(selectedId)
    } else {
      setDetail(null)
    }
  }, [selectedId, fetchDetail])

  const handlePageChange = (next: number) => {
    if (next < 1 || next > totalPages) return
    setPage(next)
    fetchList(next)
  }

  const currentTags = useMemo(
    () => inputToTags(searchTagsInput),
    [searchTagsInput],
  )

  const validationError = useMemo(() => {
    if (metaTitle.length > META_TITLE_MAX) {
      return `meta_title은 ${META_TITLE_MAX}자 이내여야 합니다`
    }
    if (metaDescription.length > META_DESCRIPTION_MAX) {
      return `meta_description은 ${META_DESCRIPTION_MAX}자 이내여야 합니다`
    }
    if (
      currentTags.length < SEARCH_TAGS_MIN ||
      currentTags.length > SEARCH_TAGS_MAX
    ) {
      return `search_tags는 ${SEARCH_TAGS_MIN}~${SEARCH_TAGS_MAX}개여야 합니다`
    }
    const imgCount = Math.min(detail?.image_count ?? 0, 3)
    for (let i = 0; i < imgCount; i++) {
      if (!altTexts[i] || altTexts[i].trim() === "") {
        return `이미지 ${i + 1}번 alt text를 입력하세요`
      }
      if (altTexts[i].length > ALT_TEXT_MAX) {
        return `이미지 ${i + 1}번 alt text는 ${ALT_TEXT_MAX}자 이내여야 합니다`
      }
    }
    return null
  }, [metaTitle, metaDescription, currentTags, altTexts, detail])

  const buildPayload = () => {
    const imgCount = Math.min(detail?.image_count ?? 0, 3)
    const image_alt_texts: DraftImageAlt[] = []
    for (let i = 0; i < imgCount; i++) {
      image_alt_texts.push({ image_index: i, alt_text: altTexts[i].trim() })
    }
    return {
      meta_title: metaTitle.trim(),
      meta_description: metaDescription.trim(),
      search_tags: currentTags,
      image_alt_texts,
    }
  }

  const handleSave = async () => {
    if (!detail || validationError) {
      if (validationError) {
        toast({ variant: "destructive", title: validationError })
      }
      return
    }
    setSubmitting("save")
    try {
      const res = await fetch(`/api/admin/seo-drafts/${detail.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload()),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error ?? `HTTP ${res.status}`)
      }
      toast({ title: "변경 저장 완료" })
      await fetchDetail(detail.id)
    } catch (e) {
      toast({
        variant: "destructive",
        title: "저장 실패",
        description: e instanceof Error ? e.message : String(e),
      })
    } finally {
      setSubmitting(null)
    }
  }

  const handleApprove = async () => {
    if (!detail || validationError) {
      if (validationError) {
        toast({ variant: "destructive", title: validationError })
      }
      return
    }
    if (!confirm(`"${detail.product_name}" draft를 승인하고 상품에 적용합니다.`)) {
      return
    }
    setSubmitting("approve")
    try {
      // 먼저 편집 내용 저장 (변경 사항 있으면)
      const patchRes = await fetch(`/api/admin/seo-drafts/${detail.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload()),
      })
      if (!patchRes.ok) {
        const j = await patchRes.json().catch(() => ({}))
        throw new Error(j.error ?? `PATCH ${patchRes.status}`)
      }
      const approveRes = await fetch(
        `/api/admin/seo-drafts/${detail.id}/approve`,
        { method: "POST" },
      )
      if (!approveRes.ok) {
        const j = await approveRes.json().catch(() => ({}))
        throw new Error(j.error ?? `approve ${approveRes.status}`)
      }
      toast({ title: "승인 완료 — 상품에 적용됨" })
      // 목록에서 제거
      setDrafts((prev) => prev.filter((d) => d.id !== detail.id))
      setTotal((t) => Math.max(0, t - 1))
      setSelectedId((prev) => {
        const idx = drafts.findIndex((d) => d.id === prev)
        const next = drafts[idx + 1] ?? drafts[idx - 1]
        return next?.id ?? null
      })
    } catch (e) {
      toast({
        variant: "destructive",
        title: "승인 실패",
        description: e instanceof Error ? e.message : String(e),
      })
    } finally {
      setSubmitting(null)
    }
  }

  const handleReject = async () => {
    if (!detail) return
    const note = window.prompt("거절 사유 (선택)") ?? undefined
    if (!confirm(`"${detail.product_name}" draft를 거절합니다.`)) return
    setSubmitting("reject")
    try {
      const res = await fetch(
        `/api/admin/seo-drafts/${detail.id}/reject`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ note }),
        },
      )
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error ?? `HTTP ${res.status}`)
      }
      toast({ title: "거절 완료" })
      setDrafts((prev) => prev.filter((d) => d.id !== detail.id))
      setTotal((t) => Math.max(0, t - 1))
      setSelectedId((prev) => {
        const idx = drafts.findIndex((d) => d.id === prev)
        const next = drafts[idx + 1] ?? drafts[idx - 1]
        return next?.id ?? null
      })
    } catch (e) {
      toast({
        variant: "destructive",
        title: "거절 실패",
        description: e instanceof Error ? e.message : String(e),
      })
    } finally {
      setSubmitting(null)
    }
  }

  const handleRegenerate = async () => {
    if (!detail) return
    if (
      !confirm(
        `"${detail.product_name}" 상품 SEO를 재생성 큐에 등록합니다. 1분 내 신규 draft가 생성됩니다.`,
      )
    ) {
      return
    }
    setSubmitting("regenerate")
    try {
      const res = await fetch(
        `/api/admin/products/${detail.product_id}/regenerate-seo`,
        { method: "POST" },
      )
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error ?? `HTTP ${res.status}`)
      }
      toast({ title: "재생성 큐 등록 완료" })
    } catch (e) {
      toast({
        variant: "destructive",
        title: "재생성 실패",
        description: e instanceof Error ? e.message : String(e),
      })
    } finally {
      setSubmitting(null)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">AI SEO Draft 검토</h1>
        <Badge variant="outline" className="text-sm">
          pending: {total}건
        </Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-4">
        {/* 좌측 목록 */}
        <div className="border rounded-lg overflow-hidden">
          <div className="bg-muted/50 px-3 py-2 text-xs font-medium text-muted-foreground">
            검토 대기 ({total}건)
          </div>
          <ul className="divide-y max-h-[calc(100vh-220px)] overflow-y-auto">
            {listLoading ? (
              <li className="p-6 text-center text-sm text-muted-foreground">
                불러오는 중...
              </li>
            ) : drafts.length === 0 ? (
              <li className="p-6 text-center text-sm text-muted-foreground">
                검토 대기중인 draft가 없습니다
              </li>
            ) : (
              drafts.map((d) => (
                <li
                  key={d.id}
                  className={cn(
                    "p-3 cursor-pointer hover:bg-muted/50 flex gap-3 items-start",
                    selectedId === d.id && "bg-muted",
                  )}
                  onClick={() => setSelectedId(d.id)}
                >
                  {d.product_thumbnail ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={d.product_thumbnail}
                      alt=""
                      className="w-12 h-12 rounded object-cover shrink-0"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded bg-muted shrink-0" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium truncate">
                      {d.product_name}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {dayjs(d.created_at).format("MM.DD HH:mm")} · $
                      {d.cost_usd.toFixed(4)}
                    </div>
                  </div>
                </li>
              ))
            )}
          </ul>

          {totalPages > 1 && (
            <div className="border-t flex items-center justify-between p-2 text-xs">
              <Button
                variant="ghost"
                size="sm"
                disabled={page <= 1}
                onClick={() => handlePageChange(page - 1)}
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </Button>
              <span className="text-muted-foreground">
                {page} / {totalPages}
              </span>
              <Button
                variant="ghost"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => handlePageChange(page + 1)}
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
        </div>

        {/* 우측 미리보기/편집 */}
        <div className="border rounded-lg p-4 space-y-6">
          {detailLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-6 w-1/3" />
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
          ) : !detail ? (
            <div className="text-center text-sm text-muted-foreground py-12">
              좌측에서 draft를 선택하세요
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="text-lg font-semibold truncate">
                    {detail.product_name}
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    /products/{detail.product_slug}
                  </p>
                </div>
                <a
                  href={`/products/${detail.product_slug}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                >
                  미리보기 <ExternalLink className="h-3 w-3" />
                </a>
              </div>

              {/* 이미지 영역 */}
              <section className="space-y-3">
                <h3 className="text-sm font-medium">
                  이미지 alt text (상위 3장 AI, 4번째+ 패턴)
                </h3>
                <div className="space-y-3">
                  {detail.product_images.slice(0, 3).map((img, idx) => (
                    <div
                      key={img.id}
                      className="flex gap-3 items-start border rounded p-2"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={img.url}
                        alt=""
                        className="w-20 h-20 rounded object-cover shrink-0"
                      />
                      <div className="flex-1 space-y-1">
                        <Label className="text-xs">
                          이미지 {idx + 1}번 alt ({altTexts[idx]?.length ?? 0}/
                          {ALT_TEXT_MAX})
                        </Label>
                        <Input
                          value={altTexts[idx] ?? ""}
                          maxLength={ALT_TEXT_MAX}
                          onChange={(e) =>
                            setAltTexts((prev) => ({
                              ...prev,
                              [idx]: e.target.value,
                            }))
                          }
                        />
                      </div>
                    </div>
                  ))}
                </div>
                {detail.product_images.length > 3 && (
                  <div className="space-y-1.5">
                    <h4 className="text-xs font-medium text-muted-foreground">
                      4번째+ 이미지 ({detail.product_images.length - 3}장, 패턴
                      자동 적용)
                    </h4>
                    <ul className="grid grid-cols-2 gap-2">
                      {detail.product_images.slice(3).map((img, idx) => (
                        <li
                          key={img.id}
                          className="flex gap-2 items-center border rounded p-1.5"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={img.url}
                            alt=""
                            className="w-10 h-10 rounded object-cover shrink-0"
                          />
                          <span className="text-xs text-muted-foreground truncate">
                            {buildPatternAlt(detail.product_name, idx + 1)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </section>

              {/* 메타데이터 편집 */}
              <section className="space-y-3">
                <h3 className="text-sm font-medium">메타데이터</h3>
                <div className="space-y-1.5">
                  <Label className="text-xs">
                    meta_title ({metaTitle.length}/{META_TITLE_MAX})
                  </Label>
                  <Input
                    value={metaTitle}
                    maxLength={META_TITLE_MAX}
                    onChange={(e) => setMetaTitle(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">
                    meta_description ({metaDescription.length}/
                    {META_DESCRIPTION_MAX})
                  </Label>
                  <textarea
                    value={metaDescription}
                    maxLength={META_DESCRIPTION_MAX}
                    onChange={(e) => setMetaDescription(e.target.value)}
                    rows={3}
                    className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">
                    search_tags (콤마 구분, {currentTags.length}개,{" "}
                    {SEARCH_TAGS_MIN}~{SEARCH_TAGS_MAX}개)
                  </Label>
                  <Input
                    value={searchTagsInput}
                    onChange={(e) => setSearchTagsInput(e.target.value)}
                    placeholder="예: 데일리룩, 베이지 원피스, ..."
                  />
                  <div className="flex flex-wrap gap-1">
                    {currentTags.map((tag, i) => (
                      <Badge key={i} variant="secondary" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              </section>

              {/* 요약 정보 */}
              <section className="text-xs text-muted-foreground grid grid-cols-2 gap-x-4 gap-y-1 border-t pt-3">
                <div>모델: {detail.model}</div>
                <div>prompt: {detail.prompt_version}</div>
                <div>cost: ${detail.cost_usd.toFixed(4)}</div>
                <div>이미지: {detail.image_count}장</div>
                <div className="col-span-2">
                  생성: {dayjs(detail.created_at).format("YYYY.MM.DD HH:mm:ss")}
                </div>
              </section>

              {/* 검증 메시지 */}
              {validationError && (
                <div className="text-xs text-destructive border border-destructive/50 bg-destructive/5 rounded px-3 py-2">
                  {validationError}
                </div>
              )}

              {/* 액션 버튼 */}
              <div className="flex flex-wrap gap-2 border-t pt-4">
                <Button
                  variant="outline"
                  onClick={handleSave}
                  disabled={submitting !== null || !!validationError}
                >
                  <Save className="h-4 w-4 mr-1.5" />
                  변경 저장
                </Button>
                <Button
                  onClick={handleApprove}
                  disabled={submitting !== null || !!validationError}
                >
                  <ThumbsUp className="h-4 w-4 mr-1.5" />
                  승인 및 적용
                </Button>
                <Button
                  variant="ghost"
                  onClick={handleReject}
                  disabled={submitting !== null}
                >
                  <ThumbsDown className="h-4 w-4 mr-1.5" />
                  거절
                </Button>
                <Button
                  variant="ghost"
                  onClick={handleRegenerate}
                  disabled={submitting !== null}
                  className="ml-auto"
                >
                  <RotateCcw className="h-4 w-4 mr-1.5" />
                  재생성
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default SeoDraftsClient
