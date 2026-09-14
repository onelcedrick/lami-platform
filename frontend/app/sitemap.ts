import { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.NEXT_PUBLIC_SITE_URL || "https://lami.mg";
  const now = new Date();

  return [
    { url: base, lastModified: now, changeFrequency: "daily", priority: 1 },
    { url: `${base}/catalog`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: `${base}/catalog?usage=gaming`, lastModified: now, changeFrequency: "weekly", priority: 0.8 },
    { url: `${base}/catalog?category=PC%20Complets`, lastModified: now, changeFrequency: "weekly", priority: 0.8 },
    { url: `${base}/login`, lastModified: now, changeFrequency: "monthly", priority: 0.3 },
    { url: `${base}/register`, lastModified: now, changeFrequency: "monthly", priority: 0.4 },
    { url: `${base}/tickets`, lastModified: now, changeFrequency: "weekly", priority: 0.5 },
  ];
}
