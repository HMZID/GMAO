import { ExternalLink } from "lucide-react";
import Link from "next/link";
import { SITE_ITEM_KIND_DEFINITIONS, type SiteItemKind } from "@/server/domain/site";
import { T } from "@/i18n/client";

/** Adresse des listes de blocs dans l'administration (type de bloc → segment d'URL). */
export const KIND_SLUGS: Record<SiteItemKind, string> = {
  HIGHLIGHT: "chiffres",
  SECTOR: "secteurs",
  FEATURE: "fonctionnalites",
  STEP: "etapes",
  TESTIMONIAL: "temoignages",
  FAQ: "questions",
};

export function kindFromSlug(slug: string): SiteItemKind | null {
  const entry = Object.entries(KIND_SLUGS).find(([, s]) => s === slug);
  return entry ? (entry[0] as SiteItemKind) : null;
}

const TABS = [
  { key: "demandes", href: "/administration/site/demandes", label: "Demandes de démo" },
  { key: "contenu", href: "/administration/site/contenu", label: "Textes et réglages" },
  ...(Object.keys(KIND_SLUGS) as SiteItemKind[]).map((kind) => ({
    key: KIND_SLUGS[kind],
    href: `/administration/site/blocs/${KIND_SLUGS[kind]}`,
    label: SITE_ITEM_KIND_DEFINITIONS[kind].plural,
  })),
  { key: "tarifs", href: "/administration/site/tarifs", label: "Offres et tarifs" },
  { key: "pages", href: "/administration/site/pages", label: "Pages" },
];

/** Onglets de l'administration du site commercial. */
export function SiteAdminNav({ active, pending }: { active: string; pending?: number }) {
  return (
    <nav aria-label="Administration du site" className="mb-6 flex items-center gap-2 overflow-x-auto border-b border-slate-200 pb-px">
      {TABS.map((t) => (
        <Link
          key={t.key}
          href={t.href}
          aria-current={t.key === active ? "page" : undefined}
          className={`-mb-px flex shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium ${
            t.key === active ? "border-brand-600 text-brand-800" : "border-transparent text-slate-600 hover:text-slate-900"
          }`}
        >
          {t.label}
          {t.key === "demandes" && pending ? (
            <span className="rounded-full bg-amber-500 px-1.5 text-[11px] font-semibold text-white">{pending}</span>
          ) : null}
        </Link>
      ))}
      <a
        href="/decouvrir"
        target="_blank"
        rel="noreferrer"
        className="ms-auto flex shrink-0 items-center gap-1 px-3 py-2 text-sm font-medium text-brand-700 hover:underline"
      >
        <T>Voir le site</T>
        <ExternalLink className="h-3.5 w-3.5" aria-hidden />
      </a>
    </nav>
  );
}
