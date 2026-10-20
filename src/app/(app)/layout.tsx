import { Bell, LogOut, ShieldCheck, Wrench } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { MobileNav } from "@/components/layout/mobile-nav";
import { NAV_ITEMS } from "@/components/layout/nav-items";
import { SidebarNav } from "@/components/layout/sidebar-nav";
import { Skeleton } from "@/components/ui/primitives";
import { LanguageSwitcher } from "@/components/i18n/language-switcher";
import { getT } from "@/i18n/server";
import { formatDate } from "@/lib/format";
import { ROLE } from "@/lib/labels";
import { getAuthContext } from "@/server/auth/session";
import { getBranding, logoUrl } from "@/server/services/branding";
import { getOwnTenantAccess } from "@/server/services/platform";
import { countUnread } from "@/server/services/notifications";
import { signOutAction, stopImpersonationAction } from "../(auth)/actions";
import { T, Tr } from "@/i18n/client";

/**
 * Coquille de l'application : la structure est statique, les éléments qui dépendent de la session
 * (menu filtré par droits, utilisateur) sont rendus sous <Suspense> (Cache Components).
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col bg-ink-900 text-white lg:flex">
        <Suspense fallback={<Brand />}>
          <TenantBrand />
        </Suspense>
        <Suspense fallback={<NavFallback />}>
          <Navigation />
        </Suspense>
        <p className="px-6 pb-4 text-xs text-slate-400">
          <T>Maintenance des engins et équipements</T>
        </p>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-2 border-b border-slate-200 bg-white/95 px-2 backdrop-blur sm:px-4 lg:px-8">
          <div className="flex items-center gap-1 lg:hidden">
            <Suspense fallback={<div className="h-11 w-11" />}>
              <MobileNavigation />
            </Suspense>
            <Suspense fallback={<MobileBrand />}>
              <TenantMobileBrand />
            </Suspense>
          </div>
          <div className="hidden lg:block" />
          <Suspense fallback={<Skeleton className="h-8 w-48" />}>
            <UserMenu />
          </Suspense>
        </header>
        {/* Marge du bas sur téléphone : la barre d'onglets ne masque pas la fin de la page. */}
        <main className="flex-1 px-3 pb-28 pt-4 sm:px-4 sm:pt-6 md:pb-8 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <Suspense fallback={null}>
              <ImpersonationBanner />
            </Suspense>
            <Suspense fallback={null}>
              <DemoBanner />
            </Suspense>
            <Tr>{children}</Tr>
          </div>
        </main>
      </div>
    </div>
  );
}

/** Marque : logo de l'organisation (à défaut, l'icône GMAO), « GMAO » et le nom de la société en dessous. */
function Brand({ label, logo }: { label?: string; logo?: string | null }) {
  return (
    <Link href="/" className="flex h-14 items-center gap-2.5 border-b border-white/10 px-6">
      <BrandMark logo={logo} className="h-8 w-8" />
      <span className="min-w-0 leading-tight">
        <span className="block text-lg font-semibold">GMAO</span>
        {label ? (
          <span className="block truncate text-xs text-slate-300">
            <Tr>{label}</Tr>
          </span>
        ) : null}
      </span>
    </Link>
  );
}

function MobileBrand({ label, logo }: { label?: string; logo?: string | null }) {
  return (
    <Link href="/" className="flex min-w-0 items-center gap-2 rounded-md px-1 py-1 text-slate-900">
      <BrandMark logo={logo} className="h-7 w-7" />
      <span className="min-w-0 leading-tight">
        <span className="block font-semibold">GMAO</span>
        {label ? (
          <span className="block max-w-40 truncate text-[11px] text-slate-500">
            <Tr>{label}</Tr>
          </span>
        ) : null}
      </span>
    </Link>
  );
}

function BrandMark({ logo, className }: { logo?: string | null; className: string }) {
  return logo ? (
    // eslint-disable-next-line @next/next/no-img-element -- image servie par l'API, après contrôle de session
    <img src={logo} alt="" className={`${className} shrink-0 rounded-md bg-white object-contain p-0.5`} />
  ) : (
    <span className={`${className} flex shrink-0 items-center justify-center rounded-md bg-brand-600 text-white`}>
      <Wrench className="h-4 w-4" aria-hidden />
    </span>
  );
}

/** Connexion « en tant que » : rappel permanent et retour au compte de l'administrateur. */
async function ImpersonationBanner() {
  const ctx = await getAuthContext();
  if (!ctx.impersonator) return null;
  const branding = await getBranding(ctx);
  return (
    <div role="status" className="mb-4 flex flex-wrap items-center gap-3 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-900">
      <p className="min-w-0 flex-1">
        <T params={{ name: ctx.name, email: ctx.email, organization: branding.label, admin: ctx.impersonator.name }}>
          {
            "Connecté en tant que {name} ({email}) — organisation {organization}. Vous voyez et agissez comme cet utilisateur ; les actions sont tracées au nom de {admin}."
          }
        </T>
      </p>
      <form action={stopImpersonationAction}>
        <button type="submit" className="rounded-md bg-red-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-800">
          <T>Revenir à mon compte</T>
        </button>
      </form>
    </div>
  );
}

/** Organisation en démonstration : jours restants, rappelés sur chaque page. */
async function DemoBanner() {
  const access = await getOwnTenantAccess(await getAuthContext());
  if (!access?.allowed || !access.demo) return null;
  const { daysLeft, endsAt } = access.demo;
  return (
    <p
      role="status"
      className={`mb-4 rounded-md border px-3 py-2 text-sm ${daysLeft <= 3 ? "border-amber-300 bg-amber-50 text-amber-900" : "border-violet-200 bg-violet-50 text-violet-900"}`}
    >
      <T params={{ days: daysLeft, date: formatDate(endsAt) }}>
        {daysLeft > 1
          ? "Version de démonstration : il reste {days} jours, jusqu'au {date}. Vos données sont conservées à la fin de la période."
          : "Version de démonstration : il reste {days} jour, jusqu'au {date}. Vos données sont conservées à la fin de la période."}
      </T>
    </p>
  );
}

async function TenantBrand() {
  const branding = await getBranding(await getAuthContext());
  return <Brand label={branding.label} logo={logoUrl(branding)} />;
}

async function TenantMobileBrand() {
  const branding = await getBranding(await getAuthContext());
  return <MobileBrand label={branding.label} logo={logoUrl(branding)} />;
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
  const t = await getT();
  const roles = ctx.roles.map((r) => t(ROLE[r] ?? r)).join(", ");
  return <MobileNav items={items} user={{ name: ctx.name, roles: roles || t("Aucun rôle") }} />;
}

async function UserMenu() {
  const ctx = await getAuthContext();
  const unread = await countUnread(ctx);
  const t = await getT();
  const roles = ctx.roles.map((r) => t(ROLE[r] ?? r)).join(", ");
  return (
    <div className="flex items-center gap-3">
      <LanguageSwitcher className="hidden sm:inline-flex" />
      <Link
        href="/notifications"
        className="relative flex h-11 w-11 items-center justify-center rounded-md text-slate-600 hover:bg-slate-100"
        aria-label={t("Notifications ({unread} non lues)", { unread })}
      >
        <Bell className="h-5 w-5" aria-hidden />
        {unread > 0 ? (
          <span className="absolute -end-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-semibold text-white">
            {unread > 99 ? "99+" : unread}
          </span>
        ) : null}
      </Link>
      <Link
        href="/compte/securite"
        className="flex h-11 w-11 items-center justify-center rounded-md text-slate-600 hover:bg-slate-100"
        aria-label={t("Sécurité du compte")}
        title={t("Sécurité du compte (double authentification)")}
      >
        <ShieldCheck className="h-5 w-5" aria-hidden />
      </Link>
      <div className="hidden text-end sm:block">
        <p className="text-sm font-medium text-slate-900">
          <Tr>{ctx.name}</Tr>
        </p>
        <p className="max-w-64 truncate text-xs text-slate-500">{roles || t("Aucun rôle")}</p>
      </div>
      <form action={signOutAction}>
        <button
          type="submit"
          className="flex h-11 w-11 items-center justify-center rounded-md text-slate-600 hover:bg-slate-100"
          aria-label={t("Se déconnecter")}
          title={t("Se déconnecter")}
        >
          <LogOut className="h-5 w-5" aria-hidden />
        </button>
      </form>
    </div>
  );
}
