import "server-only";
import { connection } from "next/server";
import { cache } from "react";
import { getPublicSite, type PublicSite } from "@/server/services/site";

/** `renderedAt` : heure d'affichage (contrôle anti-robot du formulaire de demande). */
export type SiteData = PublicSite & { year: number; renderedAt: number };

/**
 * Contenu de la vitrine pour la requête en cours (partagé par les métadonnées et la page). Rendu à la
 * requête : le contenu modifié dans l'administration est visible aussitôt, sans reconstruction.
 */
export const loadSite = cache(async (): Promise<SiteData> => {
  await connection();
  const now = new Date();
  return { ...(await getPublicSite()), year: now.getFullYear(), renderedAt: now.getTime() };
});
