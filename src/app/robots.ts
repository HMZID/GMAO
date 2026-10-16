import type { MetadataRoute } from "next";
import { deploymentEnvironment } from "@/server/domain/deployment";
import { publicUrl } from "@/server/public-url";

/**
 * Moteurs de recherche : en production, seul le site commercial est exploré ; l'application (derrière la
 * connexion) et l'environnement de développement ne le sont jamais.
 */
export default function robots(): MetadataRoute.Robots {
  if (deploymentEnvironment(process.env.VERCEL_ENV) !== "production") return { rules: { userAgent: "*", disallow: "/" } };
  return {
    rules: { userAgent: "*", allow: ["/$", "/decouvrir", "/tarifs", "/essai-gratuit", "/infos/"], disallow: "/" },
    sitemap: `${publicUrl()}/sitemap.xml`,
  };
}
