import type { NextConfig } from "next";

/** Taille maximale d'un document joint (EQP-07), plus la marge de l'enveloppe multipart. */
const uploadLimitMb = (Number(process.env.DOCUMENT_MAX_SIZE_MB) || 20) + 1;

/**
 * En-têtes de sécurité de toutes les réponses (TEC-12). Pas de CSP sur les scripts et les styles (Next.js et le site
 * public utilisent des scripts et styles en ligne) : seulement les directives sans risque de casse.
 */
const securityHeaders = [
  // Aucune page dans un cadre d'un autre site (« clickjacking » sur la connexion notamment).
  // form-action : aucun formulaire de l'application n'envoie de données vers un autre site.
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'; base-uri 'self'; object-src 'none'; form-action 'self'" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=(self), payment=(), usb=()" },
  // Ignoré en HTTP (poste local) ; en production, impose HTTPS pendant un an.
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  // Anciennes adresses des interventions (« ordres de travail ») : liens des courriels et favoris déjà diffusés.
  async redirects() {
    return [
      { source: "/ordres-de-travail", destination: "/interventions", permanent: true },
      { source: "/ordres-de-travail/:path*", destination: "/interventions/:path*", permanent: true },
      { source: "/impression/ordre-de-travail/:id", destination: "/impression/intervention/:id", permanent: true },
    ];
  },
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
