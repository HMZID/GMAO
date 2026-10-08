import Link from "next/link";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";

/** Barre de filtres d'une liste : formulaire GET (l'URL porte les filtres, partageable et sans JavaScript). */
export function FilterBar({ children, resetHref }: { children: ReactNode; resetHref: string }) {
  return (
    <form method="get" className="flex flex-wrap items-end gap-3 border-b border-slate-100 px-5 py-4">
      {children}
      <div className="flex items-center gap-2">
        <Button type="submit" variant="secondary" size="sm">
          Filtrer
        </Button>
        <Link href={resetHref} className="text-sm text-slate-500 hover:text-slate-800">
          Réinitialiser
        </Link>
      </div>
    </form>
  );
}

export { FilterField } from "./filter-field";
