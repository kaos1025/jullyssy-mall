"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import dayjs from "dayjs"
import {
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  RotateCcw,
  Save,
  Settings2,
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
  SpecMetadata,
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
// SEO-DRAFT-EDIT-INLINE-1 — PATCH endpoint와 동일 제약.
const PRODUCT_DESCRIPTION_MIN = 100
const PRODUCT_DESCRIPTION_MAX = 600

const sizeArrayToInput = (size: string[] | undefined): string =>
  (size ?? []).join(", ")

const inputToSizeArray = (input: string): string[] =>
  input
    .split(",")
    .map((t) => t.trim())
    .filter((t) => t.length > 0)

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
  // SEO-DRAFT-EDIT-INLINE-1 — replace mode 인라인 편집 state.
  const [productDescription, setProductDescription] = useState(
    initialDetail?.product_description ?? "",
  )
  const [specSize, setSpecSize] = useState(
    sizeArrayToInput(initialDetail?.spec_metadata?.size),
  )
  const [specMaterial, setSpecMaterial] = useState(
    initialDetail?.spec_metadata?.material ?? "",
  )
  const [specWashCare, setSpecWashCare] = useState(
    initialDetail?.spec_metadata?.washCare ?? "",
  )
  const [specModelInfo, setSpecModelInfo] = useState(
    initialDetail?.spec_metadata?.modelInfo ?? "",
  )

  const [submitting, setSubmitting] = useState<
    null | "save" | "approve" | "reject" | "regenerate" | "poc"
  >(null)
  /** D3 PoC — 사이드바이사이드 채택 시 자유 코멘트 (reject note + analysis). */
  const [pocComment, setPocComment] = useState("")

  const totalPages = Math.max(1, Math.ceil(total / perPage))

  // D3 PoC — 같은 product_id의 preserve + replace pending draft pair 검출.
  // detail이 PoC pair 한쪽일 경우 우측 영역을 사이드바이사이드로 분기.
  // limitation: drafts list (1 page)에서만 검출 — PoC trigger는 동일 시점에
  // 큐에 함께 들어가 같은 페이지에 표시되므로 운영 시나리오에서 충족.
  const pocPair = useMemo(() => {
    if (!detail) return null
    const oppositeMode =
      detail.description_mode === "preserve" ? "replace" : "preserve"
    const paired = drafts.find(
      (d) =>
        d.product_id === detail.product_id &&
        d.description_mode === oppositeMode &&
        d.id !== detail.id,
    )
    return paired ?? null
  }, [detail, drafts])

  // PoC 모드 시 preserve/replace draft 정렬 — UI 좌측 preserve, 우측 replace.
  const pocLeft: SeoDraftListItem | SeoDraftDetail | null = useMemo(() => {
    if (!pocPair || !detail) return null
    return detail.description_mode === "preserve" ? detail : pocPair
  }, [detail, pocPair])

  const pocRight: SeoDraftListItem | SeoDraftDetail | null = useMemo(() => {
    if (!pocPair || !detail) return null
    return detail.description_mode === "replace" ? detail : pocPair
  }, [detail, pocPair])

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
        setProductDescription(data.product_description ?? "")
        setSpecSize(sizeArrayToInput(data.spec_metadata?.size))
        setSpecMaterial(data.spec_metadata?.material ?? "")
        setSpecWashCare(data.spec_metadata?.washCare ?? "")
        setSpecModelInfo(data.spec_metadata?.modelInfo ?? "")
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
    // SEO-DRAFT-EDIT-INLINE-1 — replace mode 한정 product_description 길이 검증.
    if (detail?.description_mode === "replace") {
      const len = productDescription.length
      if (len < PRODUCT_DESCRIPTION_MIN || len > PRODUCT_DESCRIPTION_MAX) {
        return `product_description은 ${PRODUCT_DESCRIPTION_MIN}~${PRODUCT_DESCRIPTION_MAX}자여야 합니다`
      }
    }
    return null
  }, [metaTitle, metaDescription, currentTags, altTexts, detail, productDescription])

  const buildPayload = () => {
    const imgCount = Math.min(detail?.image_count ?? 0, 3)
    const image_alt_texts: DraftImageAlt[] = []
    for (let i = 0; i < imgCount; i++) {
      image_alt_texts.push({ image_index: i, alt_text: altTexts[i].trim() })
    }
    const payload: Record<string, unknown> = {
      meta_title: metaTitle.trim(),
      meta_description: metaDescription.trim(),
      search_tags: currentTags,
      image_alt_texts,
    }
    // SEO-DRAFT-EDIT-INLINE-1 — replace mode 한정 양 필드 포함.
    if (detail?.description_mode === "replace") {
      payload.product_description = productDescription.trim()
      const spec: SpecMetadata = {}
      const sizes = inputToSizeArray(specSize)
      if (sizes.length > 0) spec.size = sizes
      const material = specMaterial.trim()
      if (material) spec.material = material
      const washCare = specWashCare.trim()
      if (washCare) spec.washCare = washCare
      const modelInfo = specModelInfo.trim()
      if (modelInfo) spec.modelInfo = modelInfo
      payload.spec_metadata = spec
    }
    return payload
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

  // D3 PoC — 사이드바이사이드 채택. winner approve + loser reject sequencing.
  // approve 성공 후 reject 실패 시 부분 상태 (운영자 수동 처리 필요) — toast 알림.
  const handlePocSelect = async (winnerId: string, loserId: string) => {
    if (
      !confirm(
        `${winnerId === pocLeft?.id ? "preserve" : "replace"} draft를 채택하고 적용합니다. 다른 한쪽은 자동 거절됩니다.`,
      )
    ) {
      return
    }
    setSubmitting("poc")
    try {
      const approveRes = await fetch(
        `/api/admin/seo-drafts/${winnerId}/approve`,
        { method: "POST" },
      )
      if (!approveRes.ok) {
        const j = await approveRes.json().catch(() => ({}))
        throw new Error(j.error ?? `approve ${approveRes.status}`)
      }
      const rejectNote = `[PoC] 비교 검수에서 미채택. ${pocComment}`.trim()
      const rejectRes = await fetch(
        `/api/admin/seo-drafts/${loserId}/reject`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ note: rejectNote }),
        },
      )
      if (!rejectRes.ok) {
        const j = await rejectRes.json().catch(() => ({}))
        toast({
          variant: "destructive",
          title: "PoC 부분 실패",
          description: `채택은 성공했으나 다른 draft 거절 실패: ${j.error ?? rejectRes.status}. 수동 처리 필요.`,
        })
      } else {
        toast({ title: "PoC 채택 완료 — 상품에 적용됨" })
      }
      setDrafts((prev) =>
        prev.filter((d) => d.id !== winnerId && d.id !== loserId),
      )
      setTotal((t) => Math.max(0, t - 2))
      const remaining = drafts.filter(
        (d) => d.id !== winnerId && d.id !== loserId,
      )
      setSelectedId(remaining[0]?.id ?? null)
      setPocComment("")
    } catch (e) {
      toast({
        variant: "destructive",
        title: "PoC 채택 실패",
        description: e instanceof Error ? e.message : String(e),
      })
    } finally {
      setSubmitting(null)
    }
  }

  const handlePocRejectBoth = async () => {
    if (!pocLeft || !pocRight) return
    if (!confirm("preserve / replace 양쪽 모두 거절합니다.")) return
    setSubmitting("poc")
    try {
      const note = `[PoC] 둘 다 거절. ${pocComment}`.trim()
      const targets = [pocLeft.id, pocRight.id]
      const results = await Promise.all(
        targets.map((id) =>
          fetch(`/api/admin/seo-drafts/${id}/reject`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ note }),
          }).then((r) => ({ id, ok: r.ok })),
        ),
      )
      const failed = results.filter((r) => !r.ok)
      if (failed.length > 0) {
        toast({
          variant: "destructive",
          title: `${failed.length}건 거절 실패 — 수동 처리 필요`,
        })
      } else {
        toast({ title: "양쪽 거절 완료" })
      }
      const okIds = new Set(results.filter((r) => r.ok).map((r) => r.id))
      setDrafts((prev) => prev.filter((d) => !okIds.has(d.id)))
      setTotal((t) => Math.max(0, t - okIds.size))
      const remaining = drafts.filter((d) => !okIds.has(d.id))
      setSelectedId(remaining[0]?.id ?? null)
      setPocComment("")
    } catch (e) {
      toast({
        variant: "destructive",
        title: "PoC 거절 실패",
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
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">AI SEO Draft 검토</h1>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-sm">
            pending: {total}건
          </Badge>
          <Button asChild variant="outline" size="sm">
            <Link href="/admin/seo-drafts/backfill">
              <Settings2 className="h-4 w-4 mr-1.5" />
              Backfill
            </Link>
          </Button>
        </div>
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
                    <div className="text-sm font-medium truncate flex items-center gap-1.5">
                      <span className="truncate">{d.product_name}</span>
                      {d.description_mode === "replace" && (
                        <Badge variant="secondary" className="text-[10px] shrink-0">
                          replace
                        </Badge>
                      )}
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
          ) : pocPair && pocLeft && pocRight ? (
            <>
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-semibold truncate">
                      {detail.product_name}
                    </h2>
                    <Badge variant="secondary" className="shrink-0">PoC 비교</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    /products/{detail.product_slug} · preserve vs replace
                  </p>
                </div>
                <a
                  href={`/products/${detail.product_slug}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 shrink-0"
                >
                  미리보기 <ExternalLink className="h-3 w-3" />
                </a>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {[
                  { side: "left" as const, draft: pocLeft, label: "preserve (v0.6 baseline)", color: "bg-slate-50" },
                  { side: "right" as const, draft: pocRight, label: "replace (PoC)", color: "bg-amber-50" },
                ].map(({ side, draft, label, color }) => (
                  <div key={side} className={cn("border rounded-md p-3 space-y-2 text-xs", color)}>
                    <div className="flex items-center justify-between">
                      <Badge variant="outline" className="text-xs">{label}</Badge>
                      <span className="text-muted-foreground">${draft.cost_usd.toFixed(4)}</span>
                    </div>
                    <div>
                      <div className="text-muted-foreground">meta_title</div>
                      <div className="font-medium break-words">{draft.meta_title}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">meta_description</div>
                      <div className="break-words">{draft.meta_description}</div>
                    </div>
                    {draft.description_mode === "replace" && draft.product_description && (
                      <div>
                        <div className="text-muted-foreground">product_description</div>
                        <div className="whitespace-pre-wrap break-words border-l-2 border-amber-300 pl-2">
                          {draft.product_description}
                        </div>
                      </div>
                    )}
                    {draft.description_mode === "replace" && draft.spec_metadata && Object.keys(draft.spec_metadata).length > 0 && (
                      <div>
                        <div className="text-muted-foreground">spec_metadata</div>
                        <pre className="whitespace-pre-wrap break-words bg-white/50 rounded p-2 text-[10px] font-mono">
                          {JSON.stringify(draft.spec_metadata, null, 2)}
                        </pre>
                      </div>
                    )}
                    <div>
                      <div className="text-muted-foreground">search_tags</div>
                      <div className="flex flex-wrap gap-1">
                        {(draft.search_tags ?? []).map((tag, i) => (
                          <Badge key={i} variant="secondary" className="text-[10px]">{tag}</Badge>
                        ))}
                      </div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">image_alt_texts</div>
                      <ul className="space-y-0.5 list-disc list-inside">
                        {(draft.image_alt_texts ?? []).map((alt, i) => (
                          <li key={i} className="break-words">{alt.alt_text}</li>
                        ))}
                      </ul>
                    </div>
                    <div className="text-[10px] text-muted-foreground pt-1 border-t">
                      {draft.prompt_version} · {draft.image_count}장 · {dayjs(draft.created_at).format("MM.DD HH:mm")}
                    </div>
                  </div>
                ))}
              </div>

              <div className="space-y-2 border-t pt-3">
                <Label className="text-xs">자유 코멘트 (채택 이유 / 거절 사유, 양쪽 reject note에 함께 저장)</Label>
                <textarea
                  value={pocComment}
                  onChange={(e) => setPocComment(e.target.value)}
                  rows={2}
                  placeholder="예: preserve는 spec 표현이 정확하나 replace의 셀링포인트 묘사가 더 자연스러움"
                  className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-xs ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                />
              </div>

              <div className="flex flex-wrap gap-2 border-t pt-4">
                <Button
                  onClick={() => handlePocSelect(pocLeft.id, pocRight.id)}
                  disabled={submitting !== null}
                  variant="outline"
                >
                  <ThumbsUp className="h-4 w-4 mr-1.5" />
                  preserve 채택
                </Button>
                <Button
                  onClick={() => handlePocSelect(pocRight.id, pocLeft.id)}
                  disabled={submitting !== null}
                >
                  <ThumbsUp className="h-4 w-4 mr-1.5" />
                  replace 채택
                </Button>
                <Button
                  variant="ghost"
                  onClick={handlePocRejectBoth}
                  disabled={submitting !== null}
                  className="ml-auto"
                >
                  <ThumbsDown className="h-4 w-4 mr-1.5" />
                  둘 다 거절
                </Button>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-semibold truncate">
                      {detail.product_name}
                    </h2>
                    {detail.description_mode === "replace" && (
                      <Badge variant="secondary" className="shrink-0">replace</Badge>
                    )}
                  </div>
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

              {/* 본문 (replace mode 전용, 인라인 편집) */}
              {detail.description_mode === "replace" && (
                <section className="space-y-2">
                  <Label className="text-sm font-medium">
                    본문 (product_description) ({productDescription.length}/
                    {PRODUCT_DESCRIPTION_MAX})
                  </Label>
                  <textarea
                    value={productDescription}
                    onChange={(e) => setProductDescription(e.target.value)}
                    maxLength={PRODUCT_DESCRIPTION_MAX}
                    rows={6}
                    className="flex w-full rounded-md border border-input bg-amber-50/40 px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 whitespace-pre-wrap break-words"
                  />
                </section>
              )}

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

              {/* 사양 (replace mode 전용, 4 필드 분리 인라인 편집) */}
              {detail.description_mode === "replace" && (
                <section className="space-y-3">
                  <h3 className="text-sm font-medium">사양 (spec_metadata)</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">size (콤마 구분)</Label>
                      <Input
                        value={specSize}
                        onChange={(e) => setSpecSize(e.target.value)}
                        placeholder="예: S, M, L, FREE"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">material</Label>
                      <Input
                        value={specMaterial}
                        onChange={(e) => setSpecMaterial(e.target.value)}
                        placeholder="예: 폴리에스터 95%, 스판덱스 5%"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">washCare</Label>
                      <Input
                        value={specWashCare}
                        onChange={(e) => setSpecWashCare(e.target.value)}
                        placeholder="예: 드라이클리닝 권장"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">modelInfo</Label>
                      <Input
                        value={specModelInfo}
                        onChange={(e) => setSpecModelInfo(e.target.value)}
                        placeholder="예: 모델 신장 168cm, M 사이즈 착용"
                      />
                    </div>
                  </div>
                </section>
              )}

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
