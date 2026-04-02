"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Plus, Trash2, Upload } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { useToast } from "@/hooks/use-toast"
import { createClient } from "@/lib/supabase/client"
import type { Category, Product, ProductOption, ProductImage } from "@/types"

interface OptionRow {
  id?: string
  color: string
  size: string
  extra_price: number
  stock: number
  sku: string
}

interface ProductFormProps {
  product?: Product & {
    product_options?: ProductOption[]
    product_images?: ProductImage[]
  }
}

const ProductForm = ({ product }: ProductFormProps) => {
  const router = useRouter()
  const { toast } = useToast()
  const isEdit = !!product

  const [categories, setCategories] = useState<Category[]>([])
  const [parentCategories, setParentCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(false)

  const [form, setForm] = useState({
    name: product?.name || "",
    slug: product?.slug || "",
    category_id: product?.category_id || "",
    price: product?.price || 0,
    sale_price: product?.sale_price || 0,
    description: product?.description || "",
    material: product?.material || "",
    care_info: product?.care_info || "",
    origin: product?.origin || "",
    status: product?.status || "ACTIVE",
  })

  const [options, setOptions] = useState<OptionRow[]>(
    product?.product_options?.map((o) => ({
      id: o.id,
      color: o.color,
      size: o.size,
      extra_price: o.extra_price,
      stock: o.stock,
      sku: o.sku || "",
    })) || [{ color: "", size: "", extra_price: 0, stock: 0, sku: "" }]
  )

  const [imageFiles, setImageFiles] = useState<File[]>([])
  const [existingImages, setExistingImages] = useState<ProductImage[]>(
    product?.product_images || []
  )

  useEffect(() => {
    const fetchCategories = async () => {
      const supabase = createClient()
      const { data } = await supabase
        .from("categories")
        .select("*")
        .order("sort_order")

      if (data) {
        setCategories(data)
        setParentCategories(data.filter((c) => !c.parent_id))
      }
    }
    fetchCategories()
  }, [])

  const childCategories = categories.filter((c) => c.parent_id)

  const updateForm = (field: string, value: string | number) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const addOption = () => {
    setOptions((prev) => [
      ...prev,
      { color: "", size: "", extra_price: 0, stock: 0, sku: "" },
    ])
  }

  const removeOption = (index: number) => {
    setOptions((prev) => prev.filter((_, i) => i !== index))
  }

  const updateOption = (index: number, field: string, value: string | number) => {
    setOptions((prev) =>
      prev.map((o, i) => (i === index ? { ...o, [field]: value } : o))
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name || !form.price) {
      toast({ variant: "destructive", title: "상품명과 가격은 필수입니다" })
      return
    }

    setLoading(true)

    try {
      const formData = new FormData()
      formData.append("product", JSON.stringify(form))
      formData.append("options", JSON.stringify(options))
      formData.append(
        "existing_image_ids",
        JSON.stringify(existingImages.map((img) => img.id))
      )
      imageFiles.forEach((file) => formData.append("images", file))

      const url = isEdit
        ? `/api/admin/products/${product!.id}`
        : "/api/admin/products"
      const method = isEdit ? "PUT" : "POST"

      const res = await fetch(url, { method, body: formData })
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || "저장 실패")
      }

      if (data.image_errors) {
        toast({
          variant: "destructive",
          title: "이미지 업로드 일부 실패",
          description: data.image_errors.join(", "),
        })
      } else {
        toast({ title: isEdit ? "상품이 수정되었습니다" : "상품이 등록되었습니다" })
      }
      router.push("/admin/products")
    } catch (err) {
      toast({
        variant: "destructive",
        title: err instanceof Error ? err.message : "저장 실패",
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8 max-w-3xl">
      {/* 기본 정보 */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">기본 정보</h2>
        <div>
          <Label>상품명 *</Label>
          <Input
            value={form.name}
            onChange={(e) => updateForm("name", e.target.value)}
            required
          />
        </div>
        <div>
          <Label>URL 슬러그 (선택)</Label>
          <Input
            value={form.slug}
            onChange={(e) =>
              updateForm(
                "slug",
                e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "")
              )
            }
            placeholder="예: black-knit-top"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>카테고리</Label>
            <Select
              value={form.category_id}
              onValueChange={(v) => updateForm("category_id", v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="카테고리 선택" />
              </SelectTrigger>
              <SelectContent>
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
          </div>
          <div>
            <Label>상태</Label>
            <Select
              value={form.status}
              onValueChange={(v) => updateForm("status", v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ACTIVE">판매중</SelectItem>
                <SelectItem value="SOLDOUT">품절</SelectItem>
                <SelectItem value="HIDDEN">숨김</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>정가 *</Label>
            <Input
              type="number"
              value={form.price}
              onChange={(e) => updateForm("price", Number(e.target.value))}
              required
            />
          </div>
          <div>
            <Label>할인가</Label>
            <Input
              type="number"
              value={form.sale_price || ""}
              onChange={(e) =>
                updateForm("sale_price", Number(e.target.value) || 0)
              }
            />
          </div>
        </div>
      </section>

      <Separator />

      {/* 이미지 */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">이미지</h2>
        {existingImages.length > 0 && (
          <div className="flex gap-2 flex-wrap">
            {existingImages.map((img) => (
              <div
                key={img.id}
                className="relative h-20 w-20 rounded border overflow-hidden group"
              >
                <img
                  src={img.url}
                  alt=""
                  className="h-full w-full object-cover"
                />
                <button
                  type="button"
                  onClick={() =>
                    setExistingImages((prev) =>
                      prev.filter((i) => i.id !== img.id)
                    )
                  }
                  className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"
                >
                  <Trash2 className="h-4 w-4 text-white" />
                </button>
              </div>
            ))}
          </div>
        )}
        <div>
          <Label
            htmlFor="images"
            className="flex items-center gap-2 border border-dashed rounded-lg p-4 cursor-pointer hover:bg-muted/50 transition-colors"
          >
            <Upload className="h-5 w-5 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">
              이미지 추가 ({imageFiles.length}개 선택됨)
            </span>
          </Label>
          <input
            id="images"
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files) {
                setImageFiles(Array.from(e.target.files))
              }
            }}
          />
        </div>
      </section>

      <Separator />

      {/* 상세설명 */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">상세설명</h2>
        <textarea
          className="w-full min-h-[200px] border rounded-md p-3 text-sm resize-y"
          placeholder="상세설명 (HTML 입력 가능)"
          value={form.description}
          onChange={(e) => updateForm("description", e.target.value)}
        />
      </section>

      <Separator />

      {/* 추가 정보 */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">추가 정보</h2>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <Label>소재</Label>
            <Input
              value={form.material}
              onChange={(e) => updateForm("material", e.target.value)}
            />
          </div>
          <div>
            <Label>세탁방법</Label>
            <Input
              value={form.care_info}
              onChange={(e) => updateForm("care_info", e.target.value)}
            />
          </div>
          <div>
            <Label>원산지</Label>
            <Input
              value={form.origin}
              onChange={(e) => updateForm("origin", e.target.value)}
            />
          </div>
        </div>
      </section>

      <Separator />

      {/* 옵션 */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">옵션 (색상/사이즈)</h2>
          <Button type="button" variant="outline" size="sm" onClick={addOption}>
            <Plus className="h-4 w-4 mr-1" />
            옵션 추가
          </Button>
        </div>
        <div className="space-y-3">
          {options.map((opt, i) => (
            <div key={i} className="flex gap-2 items-end">
              <div className="flex-1">
                {i === 0 && <Label className="text-xs">색상</Label>}
                <Input
                  placeholder="색상"
                  value={opt.color}
                  onChange={(e) => updateOption(i, "color", e.target.value)}
                />
              </div>
              <div className="flex-1">
                {i === 0 && <Label className="text-xs">사이즈</Label>}
                <Input
                  placeholder="사이즈"
                  value={opt.size}
                  onChange={(e) => updateOption(i, "size", e.target.value)}
                />
              </div>
              <div className="w-24">
                {i === 0 && <Label className="text-xs">추가금액</Label>}
                <Input
                  type="number"
                  placeholder="0"
                  value={opt.extra_price || ""}
                  onChange={(e) =>
                    updateOption(i, "extra_price", Number(e.target.value))
                  }
                />
              </div>
              <div className="w-20">
                {i === 0 && <Label className="text-xs">재고</Label>}
                <Input
                  type="number"
                  placeholder="0"
                  value={opt.stock || ""}
                  onChange={(e) =>
                    updateOption(i, "stock", Number(e.target.value))
                  }
                />
              </div>
              <div className="w-24">
                {i === 0 && <Label className="text-xs">SKU</Label>}
                <Input
                  placeholder="SKU"
                  value={opt.sku}
                  onChange={(e) => updateOption(i, "sku", e.target.value)}
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => removeOption(i)}
                disabled={options.length === 1}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      </section>

      <Separator />

      <div className="flex gap-3">
        <Button type="submit" disabled={loading}>
          {loading ? "저장 중..." : isEdit ? "상품 수정" : "상품 등록"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push("/admin/products")}
        >
          취소
        </Button>
      </div>
    </form>
  )
}

export default ProductForm
