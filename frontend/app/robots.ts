import { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const base = process.env.NEXT_PUBLIC_SITE_URL || "https://lami.mg";
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin/", "/technician/", "/api/"],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}
