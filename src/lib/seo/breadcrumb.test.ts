import { describe, it, expect } from "vitest"
import { buildBreadcrumbList, buildProductBreadcrumb } from "./breadcrumb"

const SITE = "https://jullyssy.shop"

describe("buildBreadcrumbList", () => {
  it("position을 1-base 순차 부여하고 ListItem 형태로 변환", () => {
    const jsonLd = buildBreadcrumbList([
      { name: "홈", url: `${SITE}/` },
      { name: "상의", url: `${SITE}/products?category=top` },
    ])
    expect(jsonLd["@context"]).toBe("https://schema.org")
    expect(jsonLd["@type"]).toBe("BreadcrumbList")
    expect(jsonLd.itemListElement).toHaveLength(2)
    expect(jsonLd.itemListElement[0]).toEqual({
      "@type": "ListItem",
      position: 1,
      name: "홈",
      item: `${SITE}/`,
    })
    expect(jsonLd.itemListElement[1].position).toBe(2)
  })
})

describe("buildProductBreadcrumb", () => {
  it("부모+카테고리 있으면 홈>부모>카테고리>상품 (4단계)", () => {
    const jsonLd = buildProductBreadcrumb({
      siteUrl: SITE,
      productName: "플리츠 스커트",
      productSlug: "pleated-skirt",
      category: { name: "스커트", slug: "skirt" },
      parentCategory: { name: "하의", slug: "bottom" },
    })
    expect(jsonLd.itemListElement.map((i) => i.name)).toEqual([
      "홈",
      "하의",
      "스커트",
      "플리츠 스커트",
    ])
    expect(jsonLd.itemListElement.map((i) => i.position)).toEqual([1, 2, 3, 4])
    expect(jsonLd.itemListElement[1].item).toBe(
      `${SITE}/products?category=bottom`,
    )
    expect(jsonLd.itemListElement[3].item).toBe(
      `${SITE}/products/pleated-skirt`,
    )
  })

  it("부모 없으면 홈>카테고리>상품 (3단계)", () => {
    const jsonLd = buildProductBreadcrumb({
      siteUrl: SITE,
      productName: "원피스",
      productSlug: "dress-1",
      category: { name: "원피스", slug: "dress" },
      parentCategory: null,
    })
    expect(jsonLd.itemListElement.map((i) => i.name)).toEqual([
      "홈",
      "원피스",
      "원피스",
    ])
  })

  it("카테고리 없으면 홈>상품 (2단계)", () => {
    const jsonLd = buildProductBreadcrumb({
      siteUrl: SITE,
      productName: "기타상품",
      productSlug: "misc",
      category: null,
      parentCategory: null,
    })
    expect(jsonLd.itemListElement).toHaveLength(2)
    expect(jsonLd.itemListElement[1].name).toBe("기타상품")
  })

  it("siteUrl 끝 슬래시는 정규화", () => {
    const jsonLd = buildProductBreadcrumb({
      siteUrl: `${SITE}/`,
      productName: "x",
      productSlug: "x",
      category: null,
      parentCategory: null,
    })
    expect(jsonLd.itemListElement[0].item).toBe(`${SITE}/`)
    expect(jsonLd.itemListElement[1].item).toBe(`${SITE}/products/x`)
  })

  it("한글 slug는 encodeURIComponent로 안전 인코딩", () => {
    const jsonLd = buildProductBreadcrumb({
      siteUrl: SITE,
      productName: "한글상품",
      productSlug: "한글-슬러그",
      category: null,
      parentCategory: null,
    })
    expect(jsonLd.itemListElement[1].item).toBe(
      `${SITE}/products/${encodeURIComponent("한글-슬러그")}`,
    )
    expect(jsonLd.itemListElement[1].item).not.toContain("한글")
  })
})
