import type { NextConfig } from "next";

/** Taille maximale d'un document joint (EQP-07), plus la marge de l'enveloppe multipart. */
const uploadLimitMb = (Number(process.env.DOCUMENT_MAX_SIZE_MB) || 20) + 1;

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  experimental: {
    // Envoi de documents par les formulaires des fiches (Server Actions) : 1 Mo par défaut.
    serverActions: { bodySizeLimit: `${uploadLimitMb}mb` },
    // Le proxy met en mémoire le corps des requêtes de pages (10 Mo par défaut).
    proxyClientMaxBodySize: `${uploadLimitMb}mb`,
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
