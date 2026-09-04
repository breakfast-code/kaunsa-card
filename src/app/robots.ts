import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return { rules: { userAgent: "*", allow: "/", disallow: "/review" }, sitemap: "https://kaunsa-card.vercel.app/sitemap.xml" };
}
