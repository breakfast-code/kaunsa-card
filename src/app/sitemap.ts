import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = "https://kaunsa-card.vercel.app";
  return [
    { url: base, lastModified: new Date(), changeFrequency: "daily", priority: 1 },
    { url: `${base}/privacy`, lastModified: new Date("2026-08-30"), changeFrequency: "monthly", priority: 0.2 },
    { url: `${base}/terms`, lastModified: new Date("2026-08-30"), changeFrequency: "monthly", priority: 0.2 },
  ];
}
