import { Check } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";
import { PricingPlans } from "@/components/site/pricing-plans";
import { FaqList, FinalCta, SectionHeading } from "@/components/site/sections";
import { SiteChrome, SiteFallback } from "@/components/site/site-chrome";
import { loadSite } from "@/components/site/site-data";
import { settingNumber } from "@/server/domain/site";
import { T } from "@/i18n/client";

export async function generateMetadata(): Promise<Metadata> {
  const { settings } = await loadSite();
  return {
    title: { absolute: `Tarifs · ${settings["brand.name"]}` },
    description: settings["pricing.subtitle"],
    alternates: { canonical: "/tarifs" },
  };
}

/** Inclus dans toutes les offres (fonctions présentes dans l'application). */
const INCLUDED = [
  "Utilisateurs illimités",
  "Application mobile terrain",
  "Imports Excel des équipements, pièces et fournisseurs",
  "Export de toutes vos données (Excel, CSV)",
  "Journal d'audit des modifications",
  "Mises à jour incluses",
];

export default function PricingPage() {
  return (
    <Suspense fallback={<SiteFallback />}>
      <Pricing />
    </Suspense>
  );
}

async function Pricing() {
  const site = await loadSite();
  const { settings: s, plans, items } = site;
  return (
    <SiteChrome site={site}>
      <section className="site-blueprint-light border-b-2 border-asphalt bg-paper">
        <div className="mx-auto max-w-7xl px-4 pb-24 pt-16 sm:px-6">
          <SectionHeading index="01" label="Tarifs" title={s["pricing.title"]} text={s["pricing.subtitle"]} />
          <div className="mt-14">
            {plans.length > 0 ? (
              <PricingPlans
                plans={plans}
                annualMonths={settingNumber(s["pricing.annualMonths"], 12)}
                annualLabel={s["pricing.annualLabel"]}
                currency={s["pricing.currency"] || "DT"}
              />
            ) : (
              <p className="text-lg">
                <T>Tarifs sur demande : écrivez-nous.</T>
              </p>
            )}
          </div>
        </div>
      </section>
      <section className="bg-asphalt text-white">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-20 sm:px-6 lg:grid-cols-[1fr_2fr]">
          <SectionHeading index="02" label="Toujours inclus" title="Sans option cachée." dark />
          <ul className="grid gap-4 sm:grid-cols-2">
            {INCLUDED.map((i) => (
              <li key={i} className="flex items-center gap-3 border border-white/15 px-4 py-4 font-semibold">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center bg-signal text-asphalt">
                  <Check className="h-4 w-4" aria-hidden />
                </span>
                {i}
              </li>
            ))}
          </ul>
        </div>
      </section>
      {items.FAQ.length > 0 ? (
        <section className="bg-paper">
          <div className="mx-auto grid max-w-7xl gap-12 px-4 py-24 sm:px-6 lg:grid-cols-[1fr_2fr]">
            <SectionHeading index="03" label="Questions" title={s["faq.title"]} />
            <FaqList items={items.FAQ} />
          </div>
        </section>
      ) : null}
      <FinalCta title={s["cta.title"]} text={s["cta.text"]} cta={s["hero.ctaPrimary"]} />
    </SiteChrome>
  );
}
