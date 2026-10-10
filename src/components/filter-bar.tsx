import { SlidersHorizontal } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { CollapseOnMobile } from "./collapse-on-mobile";

/**
 * Barre de filtres d'une liste : formulaire GET (l'URL porte les filtres, partageable et sans JavaScript).
 * Sur téléphone, les filtres sont repliés sous « Filtres et recherche » pour montrer d'abord les résultats ;
 * sur écran plus large, ils restent toujours visibles.
 */
export function FilterBar({ children, resetHref }: { children: ReactNode; resetHref: string }) {
  return (
    <details open className="group border-b border-slate-100">
      <summary className="flex min-h-12 cursor-pointer list-none items-center gap-2 px-4 text-sm font-medium text-slate-700 md:hidden [&::-webkit-details-marker]:hidden">
        <SlidersHorizontal className="h-4 w-4" aria-hidden />
        Filtres et recherche
        <span data-active-filters className="hidden rounded-full bg-brand-100 px-2 py-0.5 text-xs text-brand-800">
          actifs
        </span>
        <span className="ml-auto text-xs text-slate-500 group-open:hidden">Afficher</span>
        <span className="ml-auto hidden text-xs text-slate-500 group-open:inline">Masquer</span>
      </summary>
      <CollapseOnMobile />
      <form method="get" className="flex flex-wrap items-end gap-3 px-4 pb-4 pt-1 max-md:*:w-full md:px-5 md:pt-4">
        {children}
        <div className="flex items-center gap-3">
          <Button type="submit" variant="secondary" className="max-md:flex-1">
            Filtrer
          </Button>
          <Link href={resetHref} className="text-sm text-slate-500 hover:text-slate-800">
            Réinitialiser
          </Link>
        </div>
      </form>
    </details>
  );
}

export { FilterField } from "./filter-field";
