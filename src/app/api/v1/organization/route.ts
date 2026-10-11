import { apiRoute } from "@/server/api/handler";
import { getBranding, logoUrl } from "@/server/services/branding";

/** Identité de l'organisation de l'utilisateur : nom affiché et adresse du logo. */
export const GET = apiRoute(async (ctx) => {
  const branding = await getBranding(ctx);
  return { name: branding.name, displayName: branding.displayName, label: branding.label, logoUrl: logoUrl(branding) };
});
