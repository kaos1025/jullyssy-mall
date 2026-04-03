import type { MetadataRoute } from "next"

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"

const robots = (): MetadataRoute.Robots => ({
  rules: {
    userAgent: "*",
    allow: "/",
    disallow: ["/admin", "/api", "/checkout", "/mypage", "/cart"],
  },
  sitemap: `${SITE_URL}/sitemap.xml`,
})

export default robots
