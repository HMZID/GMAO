import { Check } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";
import { DemoRequestForm } from "@/components/site/demo-request-form";
import { SiteChrome, SiteFallback } from "@/components/site/site-chrome";
import { loadSite } from "@/components/site/site-data";
import { settingNumber } from "@/server/domain/site";
import { T, Tr } from "@/i18n/client";

export async function generateMetadata(): Promise<Metadata> {
  const { settings } = await loadSite();
  return {
    title: { absolute: `Essai gratuit · ${settings["brand.name"]}` },
    description: settings["form.text"],
    alternates: { canonical: "/essai-gratuit" },
  };
}

/** Ce que contient l'espace de démonstration (organisation ouverte par `provisionDemoTenant`). */
const INCLUDED = [
  "Votre organisation : société, site, atelier et magasin prêts",
  "Familles d'engins de départ, modifiables",
  "Tous les modules, sans restriction",
  "Compte de direction : vous invitez vos équipes",
  "Vos données conservées à la fin de l'essai",
];

export default function TrialPage(props: PageProps<"/essai-gratuit">) {
  return (
    <Suspense fallback={<SiteFallback />}>
      <Trial searchParams={props.searchParams} />
    </Suspense>
  );
}

async function Trial({ searchParams }: { searchParams: PageProps<"/essai-gratuit">["searchParams"] }) {
  const site = await loadSite();
  const sp = await searchParams;
  const { settings: s, plans } = site;
  const days = settingNumber(s["trial.days"], 30);
  return (
    <SiteChrome site={site}>
      <section className="site-blueprint-light bg-paper-deep">
        <div className="mx-auto grid max-w-7xl gap-12 px-4 py-16 sm:px-6 lg:grid-cols-[1fr_1.25fr] lg:py-24">
          <div>
            <p className="site-label text-asphalt-500">
              <T params={{ days: days }}>{"[ Essai gratuit · {days} jours ]"}</T>
            </p>
            <h1 className="site-display mt-4 text-5xl sm:text-6xl">
              <Tr>{s["form.title"]}</Tr>
            </h1>
            <p className="mt-6 text-lg text-asphalt-500">
              <Tr>{s["form.text"]}</Tr>
            </p>
            <ul className="mt-8 space-y-3">
              {INCLUDED.map((i) => (
                <li key={i} className="flex items-start gap-3 font-semibold">
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center border-2 border-asphalt bg-signal">
                    <Check className="h-3.5 w-3.5" aria-hidden />
                  </span>
                  <Tr>{i}</Tr>
                </li>
              ))}
            </ul>
            <ol className="mt-10 border-s-4 border-asphalt ps-5 text-sm">
              {[
                "Vous envoyez la demande",
                "Nous l'examinons et ouvrons votre espace",
                "Vous recevez le lien, l'identifiant et le mot de passe provisoire",
              ].map((step, i) => (
                <li key={step} className="py-1.5">
                  <span className="font-plate me-2 font-bold">{String(i + 1).padStart(2, "0")}</span>
                  <Tr>{step}</Tr>
                </li>
              ))}
            </ol>
          </div>
          <div className="relative border-2 border-asphalt bg-paper p-6 shadow-[10px_10px_0_var(--color-asphalt)] sm:p-8">
            <p className="site-label absolute -top-3.5 end-6 border-2 border-asphalt bg-signal px-2 py-1 text-[10px]">
              <T>Sans carte bancaire</T>
            </p>
            <DemoRequestForm
              startedAt={site.renderedAt}
              plans={plans.map((p) => p.name)}
              plan={typeof sp.offre === "string" ? sp.offre : undefined}
              emailNotice={s["form.emailNotice"]}
            />
          </div>
        </div>
      </section>
    </SiteChrome>
  );
}
