import { ArrowRight, LogIn, Mail, Menu, Phone, Wrench } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { settingEnabled, type SiteSettings } from "@/server/domain/site";
import type { SiteData } from "./site-data";

const NAV = [
  { href: "/decouvrir#fonctionnalites", label: "Fonctionnalités" },
  { href: "/decouvrir#demarrage", label: "Démarrage" },
  { href: "/tarifs", label: "Tarifs" },
  { href: "/decouvrir#questions", label: "Questions" },
];

/** Marque du site : pastille jaune et nom du produit en capitales condensées. */
export function SiteBrand({ name, className = "" }: { name: string; className?: string }) {
  return (
    <Link href="/" className={`flex items-center gap-2.5 ${className}`} aria-label={`${name} — accueil`}>
      <span className="flex h-9 w-9 -rotate-6 items-center justify-center border-2 border-asphalt bg-signal text-asphalt">
        <Wrench className="h-5 w-5 rotate-6" aria-hidden />
      </span>
      <span className="site-display text-2xl leading-none">{name}</span>
    </Link>
  );
}

function Announcement({ settings }: { settings: SiteSettings }) {
  if (!settingEnabled(settings["announcement.enabled"]) || !settings["announcement.text"]) return null;
  const href = settings["announcement.linkHref"];
  return (
    <div className="bg-signal text-asphalt">
      <p className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-x-3 gap-y-1 px-4 py-2 text-center text-sm font-semibold">
        <span className="site-label rounded-sm bg-asphalt px-1.5 py-0.5 text-[10px] text-signal">Offre</span>
        <span>{settings["announcement.text"]}</span>
        {href && settings["announcement.linkLabel"] ? (
          <Link href={href} className="inline-flex items-center gap-1 underline decoration-2 underline-offset-4 hover:no-underline">
            {settings["announcement.linkLabel"]}
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        ) : null}
      </p>
    </div>
  );
}

function Header({ settings }: { settings: SiteSettings }) {
  return (
    <header className="sticky top-0 z-40 border-b-2 border-asphalt bg-paper/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
        <SiteBrand name={settings["brand.name"]} />
        <nav aria-label="Navigation du site" className="hidden items-center gap-7 text-sm font-semibold lg:flex">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className="hover:underline hover:decoration-signal hover:decoration-4 hover:underline-offset-8">
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <Link href="/login" className="hidden items-center gap-1.5 px-3 py-2 text-sm font-semibold hover:underline sm:inline-flex">
            <LogIn className="h-4 w-4" aria-hidden />
            Se connecter
          </Link>
          <Link href="/essai-gratuit" className="site-btn site-btn-signal min-h-10 px-4 text-sm">
            Essai gratuit
          </Link>
          {/* Menu des téléphones : sans JavaScript (élément details). */}
          <details className="group relative lg:hidden">
            <summary className="flex h-10 w-10 cursor-pointer list-none items-center justify-center border-2 border-asphalt [&::-webkit-details-marker]:hidden">
              <Menu className="h-5 w-5" aria-hidden />
              <span className="sr-only">Menu</span>
            </summary>
            <nav
              aria-label="Navigation du site (mobile)"
              className="absolute right-0 top-12 w-64 border-2 border-asphalt bg-paper p-2 shadow-[6px_6px_0_var(--color-asphalt)]"
            >
              {[...NAV, { href: "/login", label: "Se connecter" }].map((n) => (
                <Link key={n.href} href={n.href} className="block px-3 py-3 font-semibold hover:bg-paper-deep">
                  {n.label}
                </Link>
              ))}
            </nav>
          </details>
        </div>
      </div>
    </header>
  );
}

function Footer({ site }: { site: SiteData }) {
  const { settings, footerPages } = site;
  return (
    <footer className="bg-asphalt text-white">
      <div className="site-hazard h-2" aria-hidden />
      <div className="site-blueprint">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-2 lg:grid-cols-4">
          <div className="lg:col-span-2">
            <SiteBrand name={settings["brand.name"]} className="[&_span:last-child]:text-white" />
            <p className="mt-4 max-w-md text-white/70">{settings["brand.baseline"]}</p>
            <Link href="/essai-gratuit" className="site-btn site-btn-signal mt-6">
              {settings["hero.ctaPrimary"]}
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </div>
          <div>
            <h2 className="site-label text-signal">Produit</h2>
            <ul className="mt-4 space-y-2 text-white/80">
              {NAV.map((n) => (
                <li key={n.href}>
                  <Link href={n.href} className="hover:text-signal">
                    {n.label}
                  </Link>
                </li>
              ))}
              <li>
                <Link href="/login" className="hover:text-signal">
                  Se connecter
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h2 className="site-label text-signal">Contact</h2>
            <ul className="mt-4 space-y-2 text-white/80">
              {settings["contact.email"] ? (
                <li>
                  <a href={`mailto:${settings["contact.email"]}`} className="inline-flex items-center gap-2 break-all hover:text-signal">
                    <Mail className="h-4 w-4 shrink-0" aria-hidden />
                    {settings["contact.email"]}
                  </a>
                </li>
              ) : null}
              {settings["contact.phone"] ? (
                <li>
                  <a href={`tel:${settings["contact.phone"].replace(/\s/g, "")}`} className="inline-flex items-center gap-2 hover:text-signal">
                    <Phone className="h-4 w-4" aria-hidden />
                    {settings["contact.phone"]}
                  </a>
                </li>
              ) : null}
              {footerPages.map((p) => (
                <li key={p.slug}>
                  <Link href={`/infos/${p.slug}`} className="hover:text-signal">
                    {p.title}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <p className="site-label mx-auto max-w-7xl border-t border-white/10 px-4 py-5 text-[11px] text-white/50 sm:px-6">
          © {site.year} {settings["brand.name"]} · Maintenance des engins, véhicules et équipements
        </p>
      </div>
    </footer>
  );
}

/** Cadre commun des pages du site : bandeau d'offre, en-tête, contenu, pied de page. */
export function SiteChrome({ site, children }: { site: SiteData; children: ReactNode }) {
  return (
    <>
      <Announcement settings={site.settings} />
      <Header settings={site.settings} />
      <main id="contenu">{children}</main>
      <Footer site={site} />
    </>
  );
}

/** Attente du contenu (base de données) : silhouette de l'en-tête et du bandeau principal. */
export function SiteFallback() {
  return (
    <div aria-busy="true" aria-label="Chargement">
      <div className="h-16 border-b-2 border-asphalt bg-paper" />
      <div className="site-blueprint h-[70vh] bg-asphalt" />
    </div>
  );
}
