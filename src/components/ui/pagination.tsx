import Link from "next/link";
import { withParams } from "@/lib/utils";

/** Pagination par liens (fonctionne sans JavaScript) ; conserve les filtres de la liste. */
export function Pagination({
  path,
  params,
  page,
  pageSize,
  total,
}: {
  path: string;
  params: Record<string, string | undefined>;
  page: number;
  pageSize: number;
  total: number;
}) {
  const pages = Math.max(Math.ceil(total / pageSize), 1);
  const first = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, total);
  const link = (p: number) => withParams(path, { ...params, page: p > 1 ? p : undefined });
  return (
    <div className="flex items-center justify-between gap-4 border-t border-slate-100 px-5 py-3 text-sm text-slate-600">
      <p>{total === 0 ? "Aucun résultat" : `${first}–${last} sur ${total}`}</p>
      {pages > 1 ? (
        <nav aria-label="Pagination" className="flex items-center gap-2">
          {page > 1 ? (
            <Link href={link(page - 1)} className="rounded-md px-3 py-1.5 ring-1 ring-slate-300 hover:bg-slate-50">
              Précédent
            </Link>
          ) : null}
          <span className="tabular-nums">
            Page {page} / {pages}
          </span>
          {page < pages ? (
            <Link href={link(page + 1)} className="rounded-md px-3 py-1.5 ring-1 ring-slate-300 hover:bg-slate-50">
              Suivant
            </Link>
          ) : null}
        </nav>
      ) : null}
    </div>
  );
}
