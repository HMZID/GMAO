"use client";

import { Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import type { NavItem } from "./nav-items";
import { NAV_ICONS, isActive } from "./sidebar-nav";

type Item = Pick<NavItem, "href" | "label" | "icon">;

/** Rubriques de la barre du bas, dans cet ordre, parmi celles autorisées (les autres sont dans « Menu »). */
const BOTTOM_PRIORITY = ["/", "/interventions", "/demandes", "/equipements", "/planning", "/validations", "/stock"];

/** Libellés courts de la barre du bas (écran étroit). */
const SHORT_LABEL: Record<string, string> = {
  "/": "Accueil",
  "/interventions": "Interventions",
  "/demandes": "Demandes",
  "/equipements": "Engins",
  "/planning": "Planning",
  "/validations": "Validations",
  "/stock": "Stock",
};

/**
 * Navigation des téléphones et tablettes : bouton « Menu » dans l'en-tête (panneau latéral avec toutes les
 * rubriques), et barre d'onglets en bas de l'écran sur téléphone, à portée de pouce, pour les rubriques
 * principales. Le panneau se ferme au changement de page, sur Échap et en touchant le fond.
 * Panneau et barre sont rendus dans <body> (portail) : l'en-tête flouté (backdrop-filter) confinerait
 * sinon les éléments « fixed » à sa propre boîte.
 */
const noop = () => () => {};
export function MobileNav({ items, user }: { items: Item[]; user: { name: string; roles: string } }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  // Vrai côté navigateur seulement : le portail n'existe pas au rendu serveur.
  const mounted = useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
  const bottom = BOTTOM_PRIORITY.map((href) => items.find((i) => i.href === href))
    .filter((i): i is Item => !!i)
    .slice(0, 4);

  // Fermeture au changement de page (ajustement d'état pendant le rendu, sans effet).
  const [shownFor, setShownFor] = useState(pathname);
  if (shownFor !== pathname) {
    setShownFor(pathname);
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-expanded={open}
        aria-controls="menu-mobile"
        className="flex h-11 w-11 items-center justify-center rounded-md text-slate-700 hover:bg-slate-100 lg:hidden"
      >
        <Menu className="h-6 w-6" aria-hidden />
        <span className="sr-only">Ouvrir le menu</span>
      </button>

      {mounted && open
        ? createPortal(
            <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu" id="menu-mobile">
              <button type="button" className="absolute inset-0 bg-slate-900/50" aria-label="Fermer le menu" onClick={() => setOpen(false)} />
              <div className="absolute inset-y-0 start-0 flex w-[min(20rem,85vw)] flex-col bg-ink-900 text-white shadow-xl">
                <div className="flex h-14 items-center justify-between border-b border-white/10 px-4">
                  <span className="text-lg font-semibold">GMAO</span>
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="flex h-11 w-11 items-center justify-center rounded-md hover:bg-white/10"
                  >
                    <X className="h-6 w-6" aria-hidden />
                    <span className="sr-only">Fermer le menu</span>
                  </button>
                </div>
                <div className="border-b border-white/10 px-4 py-3">
                  <p className="font-medium">{user.name}</p>
                  <p className="text-xs text-slate-300">{user.roles}</p>
                </div>
                <nav aria-label="Navigation principale" className="flex-1 space-y-1 overflow-y-auto p-3">
                  {items.map((item) => {
                    const Icon = NAV_ICONS[item.icon];
                    const active = isActive(pathname, item.href);
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        aria-current={active ? "page" : undefined}
                        onClick={() => setOpen(false)}
                        className={cn(
                          "flex min-h-12 items-center gap-3 rounded-md px-3 text-base font-medium",
                          active ? "bg-white/15 text-white" : "text-slate-200 hover:bg-white/5",
                        )}
                      >
                        <Icon className="h-5 w-5 shrink-0" aria-hidden />
                        {item.label}
                      </Link>
                    );
                  })}
                </nav>
              </div>
            </div>,
            document.body,
          )
        : null}

      {mounted && bottom.length > 0
        ? createPortal(
            <nav
              aria-label="Rubriques principales"
              className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
            >
              <ul className="grid" style={{ gridTemplateColumns: `repeat(${bottom.length + 1}, minmax(0, 1fr))` }}>
                {bottom.map((item) => {
                  const Icon = NAV_ICONS[item.icon];
                  const active = isActive(pathname, item.href);
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        aria-current={active ? "page" : undefined}
                        className={cn(
                          "flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-medium",
                          active ? "text-brand-700" : "text-slate-600",
                        )}
                      >
                        <Icon className={cn("h-5 w-5", active && "stroke-[2.5]")} aria-hidden />
                        {SHORT_LABEL[item.href] ?? item.label}
                      </Link>
                    </li>
                  );
                })}
                <li>
                  <button
                    type="button"
                    onClick={() => setOpen(true)}
                    className="flex h-16 w-full flex-col items-center justify-center gap-1 text-[11px] font-medium text-slate-600"
                  >
                    <Menu className="h-5 w-5" aria-hidden />
                    Menu
                  </button>
                </li>
              </ul>
            </nav>,
            document.body,
          )
        : null}
    </>
  );
}
