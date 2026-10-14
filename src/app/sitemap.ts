import type { MetadataRoute } from "next";
import { connection } from "next/server";
import { publicUrl } from "@/server/public-url";
import { listPublishedPages } from "@/server/services/site";

/** Plan du site commercial : pages fixes et pages libres publiées. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  await connection();
  const base = publicUrl();
  const pages = await listPublishedPages();
  return [
    { url: `${base}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/tarifs`, changeFrequency: "monthly", priority: 0.9 },
    { url: `${base}/essai-gratuit`, changeFrequency: "monthly", priority: 0.9 },
    ...pages.map((p) => ({ url: `${base}/infos/${p.slug}`, lastModified: p.updatedAt, changeFrequency: "yearly" as const, priority: 0.3 })),
  ];
}
