"use client"

import { useState, useEffect } from "react"
import { Save } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"

interface Category {
  id: string
  parent_id: string | null
  name: string
  slug: string
  sort_order: number
}

interface CategoryMapping {
  id: string
  naver_category_id: string
  naver_category_name: string | null
  category_id: string | null
  categories: { id: string; name: string; parent_id: string | null } | null
}

const CategoryMappingPage = () => {
  const { toast } = useToast()
  const [mappings, setMappings] = useState<CategoryMapping[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [changes, setChanges] = useState<Map<string, string | null>>(new Map())
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const fetchData = async () => {
      const res = await fetch("/api/admin/category-mapping")
      const data = await res.json()
      if (!data.error) {
        setMappings(data.mappings)
        setCategories(data.categories)
      }
      setLoading(false)
    }
    fetchData()
  }, [])

  const parentCategories = categories.filter((c) => !c.parent_id)
  const childCategories = categories.filter((c) => c.parent_id)

  const getCategoryLabel = (categoryId: string | null) => {
    if (!categoryId) return null
    const cat = categories.find((c) => c.id === categoryId)
    if (!cat) return null
    if (cat.parent_id) {
      const parent = categories.find((c) => c.id === cat.parent_id)
      return parent ? `${parent.name} > ${cat.name}` : cat.name
    }
    return cat.name
  }

  const handleChange = (mappingId: string, categoryId: string | null) => {
    setChanges((prev) => {
      const next = new Map(prev)
      next.set(mappingId, categoryId)
      return next
    })
  }

  const getCurrentValue = (mapping: CategoryMapping) => {
    if (changes.has(mapping.id)) {
      return changes.get(mapping.id) || "none"
    }
    return mapping.category_id || "none"
  }

  const handleSave = async () => {
    if (changes.size === 0) {
      toast({ title: "변경사항이 없습니다" })
      return
    }

    setSaving(true)
    const mappingsToSave = Array.from(changes.entries()).map(([id, category_id]) => ({
      id,
      category_id: category_id || null,
    }))

    const res = await fetch("/api/admin/category-mapping", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mappings: mappingsToSave }),
    })

    const data = await res.json()
    if (data.error) {
      toast({ variant: "destructive", title: "저장 실패", description: data.error })
    } else {
      toast({ title: `${changes.size}건 매핑 저장 완료` })
      setChanges(new Map())
      // 새로고침
      const refreshRes = await fetch("/api/admin/category-mapping")
      const refreshData = await refreshRes.json()
      if (!refreshData.error) {
        setMappings(refreshData.mappings)
      }
    }
    setSaving(false)
  }

  const unmappedCount = mappings.filter((m) => {
    const current = changes.has(m.id) ? changes.get(m.id) : m.category_id
    return !current
  }).length

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">카테고리 매핑</h1>
          <p className="text-sm text-muted-foreground mt-1">
            네이버 스마트스토어 카테고리를 쥴리씨 카테고리에 매핑합니다
          </p>
        </div>
        <div className="flex items-center gap-3">
          {unmappedCount > 0 && (
            <Badge variant="destructive">{unmappedCount}개 미매핑</Badge>
          )}
          <Button onClick={handleSave} disabled={changes.size === 0 || saving}>
            <Save className="h-4 w-4 mr-2" />
            {saving ? "저장 중..." : `저장 (${changes.size}건)`}
          </Button>
        </div>
      </div>

      <div className="border rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="p-3 text-left">네이버 카테고리</th>
              <th className="p-3 text-center w-10"></th>
              <th className="p-3 text-left">쥴리씨 카테고리</th>
              <th className="p-3 text-center">상태</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={4} className="text-center py-10 text-muted-foreground">
                  로딩 중...
                </td>
              </tr>
            ) : mappings.length === 0 ? (
              <tr>
                <td colSpan={4} className="text-center py-10 text-muted-foreground">
                  매핑할 네이버 카테고리가 없습니다.
                  <br />
                  <span className="text-xs">상품을 임포트하면 네이버 카테고리가 자동으로 수집됩니다.</span>
                </td>
              </tr>
            ) : (
              mappings.map((mapping) => {
                const currentValue = getCurrentValue(mapping)
                const isMapped = currentValue !== "none"
                const isChanged = changes.has(mapping.id)

                return (
                  <tr key={mapping.id} className={`border-t hover:bg-muted/30 ${isChanged ? "bg-yellow-50/50" : ""}`}>
                    <td className="p-3">
                      <p className="font-medium">{mapping.naver_category_name || "알 수 없음"}</p>
                      <p className="text-xs text-muted-foreground">{mapping.naver_category_id}</p>
                    </td>
                    <td className="p-3 text-center text-muted-foreground">→</td>
                    <td className="p-3">
                      <Select
                        value={currentValue}
                        onValueChange={(v) => handleChange(mapping.id, v === "none" ? null : v)}
                      >
                        <SelectTrigger className="w-[250px]">
                          <SelectValue placeholder="선택해주세요">
                            {isMapped ? getCategoryLabel(currentValue === "none" ? null : currentValue) : "선택해주세요"}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">선택해주세요</SelectItem>
                          {parentCategories.map((parent) => (
                            <div key={parent.id}>
                              <SelectItem value={parent.id} className="font-medium">
                                {parent.name}
                              </SelectItem>
                              {childCategories
                                .filter((c) => c.parent_id === parent.id)
                                .map((child) => (
                                  <SelectItem key={child.id} value={child.id} className="pl-6">
                                    {child.name}
                                  </SelectItem>
                                ))}
                            </div>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="p-3 text-center">
                      <Badge variant={isMapped ? "default" : "destructive"}>
                        {isMapped ? "매핑됨" : "미매핑"}
                      </Badge>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default CategoryMappingPage
