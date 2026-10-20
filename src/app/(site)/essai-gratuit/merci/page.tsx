import { ArrowRight, MailCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { SiteChrome, SiteFallback } from "@/components/site/site-chrome";
import { loadSite } from "@/components/site/site-data";
import { T, Tr } from "@/i18n/client";

export const metadata: Metadata = { title: "Demande reçue", robots: { index: false, follow: false } };

export default function ThanksPage() {
  return (
    <Suspense fallback={<SiteFallback />}>
      <Thanks />
    </Suspense>
  );
}

async function Thanks() {
  const site = await loadSite();
  const s = site.settings;
  return (
    <SiteChrome site={site}>
      <section className="site-blueprint bg-asphalt text-white">
        <div className="mx-auto max-w-3xl px-4 py-24 text-center sm:px-6">
          <span className="mx-auto flex h-16 w-16 -rotate-6 items-center justify-center border-2 border-white bg-signal text-asphalt">
            <MailCheck className="h-8 w-8 rotate-6" aria-hidden />
          </span>
          <h1 className="site-display mt-8 text-5xl sm:text-6xl">
            <Tr>{s["form.thanksTitle"]}</Tr>
          </h1>
          <p className="mt-6 text-lg text-white/75">
            <Tr>{s["form.thanksText"]}</Tr>
          </p>
          <div className="mt-10 flex flex-wrap justify-center gap-4">
            <Link href="/decouvrir#fonctionnalites" className="site-btn site-btn-signal">
              <T>Revoir les fonctionnalités</T>
              <ArrowRight className="rtl-flip h-4 w-4" aria-hidden />
            </Link>
            <Link href="/login" className="site-btn site-btn-ghost border-white/40">
              <T>Déjà reçu vos accès ? Se connecter</T>
            </Link>
          </div>
        </div>
      </section>
    </SiteChrome>
  );
}
