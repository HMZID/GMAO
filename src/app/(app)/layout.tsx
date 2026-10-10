import { Bell, LogOut, Wrench } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { MobileNav } from "@/components/layout/mobile-nav";
import { NAV_ITEMS } from "@/components/layout/nav-items";
import { SidebarNav } from "@/components/layout/sidebar-nav";
import { Skeleton } from "@/components/ui/primitives";
import { ROLE } from "@/lib/labels";
import { getAuthContext } from "@/server/auth/session";
import { countUnread } from "@/server/services/notifications";
import { signOutAction } from "../(auth)/actions";

/**
 * Coquille de l'application : la structure est statique, les éléments qui dépendent de la session
 * (menu filtré par droits, utilisateur) sont rendus sous <Suspense> (Cache Components).
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col bg-ink-900 text-white lg:flex">
        <Brand />
        <Suspense fallback={<NavFallback />}>
          <Navigation />
        </Suspense>
        <p className="px-6 pb-4 text-xs text-slate-400">Maintenance des engins et équipements</p>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-2 border-b border-slate-200 bg-white/95 px-2 backdrop-blur sm:px-4 lg:px-8">
          <div className="flex items-center gap-1 lg:hidden">
            <Suspense fallback={<div className="h-11 w-11" />}>
              <MobileNavigation />
            </Suspense>
            <Link href="/" className="flex items-center gap-2 rounded-md px-1 py-1 font-semibold text-slate-900">
              <span className="flex h-7 w-7 items-center justify-center rounded-md bg-brand-600 text-white">
                <Wrench className="h-4 w-4" aria-hidden />
              </span>
              GMAO
            </Link>
          </div>
          <div className="hidden lg:block" />
          <Suspense fallback={<Skeleton className="h-8 w-48" />}>
            <UserMenu />
          </Suspense>
        </header>
        {/* Marge du bas sur téléphone : la barre d'onglets ne masque pas la fin de la page. */}
        <main className="flex-1 px-3 pb-28 pt-4 sm:px-4 sm:pt-6 md:pb-8 lg:px-8">
          <div className="mx-auto max-w-7xl">{children}</div>
        </main>
      </div>
    </div>
  );
}

function Brand() {
  return (
    <Link href="/" className="flex h-14 items-center gap-2 border-b border-white/10 px-6">
      <span className="flex h-8 w-8 items-center justify-center rounded-md bg-brand-600">
        <Wrench className="h-4 w-4" aria-hidden />
      </span>
      <span className="text-lg font-semibold">GMAO</span>
    </Link>
  );
}

function NavFallback() {
  return (
    <div className="space-y-2 px-3 py-4">
      {Array.from({ length: 8 }, (_, i) => (
        <div key={i} className="h-8 animate-pulse rounded-md bg-white/5" />
      ))}
    </div>
  );
}

async function allowedItems() {
  const ctx = await getAuthContext();
  const items = NAV_ITEMS.filter((item) => (item.anyOf ? item.anyOf.some((p) => ctx.can(p)) : !item.permission || ctx.can(item.permission))).map(
    ({ href, label, icon }) => ({ href, label, icon }),
  );
  return { ctx, items };
}

async function Navigation() {
  const { items } = await allowedItems();
  return <SidebarNav items={items} />;
}

/** Téléphones et tablettes : panneau de menu et barre d'onglets du bas. */
async function MobileNavigation() {
  const { ctx, items } = await allowedItems();
  const roles = ctx.roles.map((r) => ROLE[r] ?? r).join(", ");
  return <MobileNav items={items} user={{ name: ctx.name, roles: roles || "Aucun rôle" }} />;
}

async function UserMenu() {
  const ctx = await getAuthContext();
  const unread = await countUnread(ctx);
  const roles = ctx.roles.map((r) => ROLE[r] ?? r).join(", ");
  return (
    <div className="flex items-center gap-3">
      <Link
        href="/notifications"
        className="relative flex h-11 w-11 items-center justify-center rounded-md text-slate-600 hover:bg-slate-100"
        aria-label={`Notifications (${unread} non lues)`}
      >
        <Bell className="h-5 w-5" aria-hidden />
        {unread > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-semibold text-white">
            {unread > 99 ? "99+" : unread}
          </span>
        ) : null}
      </Link>
      <div className="hidden text-right sm:block">
        <p className="text-sm font-medium text-slate-900">{ctx.name}</p>
        <p className="max-w-64 truncate text-xs text-slate-500">{roles || "Aucun rôle"}</p>
      </div>
      <form action={signOutAction}>
        <button
          type="submit"
          className="flex h-11 w-11 items-center justify-center rounded-md text-slate-600 hover:bg-slate-100"
          aria-label="Se déconnecter"
          title="Se déconnecter"
        >
          <LogOut className="h-5 w-5" aria-hidden />
        </button>
      </form>
    </div>
  );
}
