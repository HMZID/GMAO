import { ArrowRight, Quote } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { HeroConsole } from "@/components/site/hero-console";
import { PricingPlans } from "@/components/site/pricing-plans";
import { RoiCalculator } from "@/components/site/roi-calculator";
import { FaqList, FinalCta, SectionHeading } from "@/components/site/sections";
import { SiteChrome, SiteFallback } from "@/components/site/site-chrome";
import { loadSite } from "@/components/site/site-data";
import { SiteIcon } from "@/components/site/site-icon";
import { settingEnabled, settingNumber } from "@/server/domain/site";

export async function generateMetadata(): Promise<Metadata> {
  const { settings } = await loadSite();
  return {
    title: { absolute: settings["seo.title"] },
    description: settings["seo.description"],
    alternates: { canonical: "/" },
    openGraph: { title: settings["seo.title"], description: settings["seo.description"], type: "website", locale: "fr_FR" },
  };
}

/** Accueil du site commercial (servi sur « / » aux visiteurs non connectés). */
export default function HomePage() {
  return (
    <Suspense fallback={<SiteFallback />}>
      <Home />
    </Suspense>
  );
}

async function Home() {
  const site = await loadSite();
  const { settings: s, items, plans } = site;
  let n = 0;
  const next = () => String(++n).padStart(2, "0");
  const roi = settingEnabled(s["roi.enabled"]);

  return (
    <SiteChrome site={site}>
      {/* Accroche */}
      <section className="site-blueprint relative overflow-hidden bg-asphalt text-white">
        <div className="mx-auto grid max-w-7xl items-center gap-16 px-4 pb-24 pt-16 sm:px-6 lg:grid-cols-[1.15fr_1fr] lg:pb-32 lg:pt-24">
          <div>
            <p className="site-label inline-flex items-center gap-2 border border-white/20 px-2.5 py-1.5 text-[11px] text-signal">
              <span className="h-2 w-2 bg-signal" aria-hidden />
              {s["hero.eyebrow"]}
            </p>
            <h1 className="site-display mt-6 text-6xl sm:text-7xl xl:text-8xl">
              {s["hero.title"]} <span className="block text-signal">{s["hero.highlight"]}</span>
            </h1>
            <p className="mt-7 max-w-xl text-lg text-white/75">{s["hero.subtitle"]}</p>
            <div className="mt-9 flex flex-wrap gap-4">
              <Link href="/essai-gratuit" className="site-btn site-btn-signal text-base">
                {s["hero.ctaPrimary"]}
                <ArrowRight className="rtl-flip h-5 w-5" aria-hidden />
              </Link>
              <Link href="/tarifs" className="site-btn site-btn-ghost border-white/40 text-base">
                {s["hero.ctaSecondary"]}
              </Link>
            </div>
            {s["hero.reassurance"] ? <p className="site-label mt-6 text-[11px] text-white/55">{s["hero.reassurance"]}</p> : null}
          </div>
          <HeroConsole />
        </div>
        {/* Défilement des fonctionnalités */}
        {items.FEATURE.length > 0 ? (
          <div className="overflow-hidden border-y-2 border-asphalt bg-signal py-3 text-asphalt" aria-hidden>
            <div className="animate-site-marquee motion-safe-only flex w-max gap-10">
              {[...items.FEATURE, ...items.FEATURE].map((f, i) => (
                <span key={i} className="site-display flex items-center gap-10 whitespace-nowrap text-2xl">
                  {f.title}
                  <span className="h-2.5 w-2.5 rotate-45 bg-asphalt" />
                </span>
              ))}
            </div>
          </div>
        ) : null}
      </section>

      {/* Chiffres clés */}
      {items.HIGHLIGHT.length > 0 ? (
        <section className="border-b-2 border-asphalt bg-paper">
          <dl className="mx-auto grid max-w-7xl grid-cols-2 lg:grid-cols-4">
            {items.HIGHLIGHT.map((h) => (
              <div key={h.id} className="border-asphalt px-4 py-10 odd:border-e-2 sm:px-8 lg:border-e-2 lg:last:border-e-0">
                <dt className="sr-only">{h.body}</dt>
                <dd>
                  <p className="site-display text-6xl sm:text-7xl">
                    {h.title}
                    {h.meta ? <span className="ms-1 text-3xl text-asphalt-500">{h.meta}</span> : null}
                  </p>
                  {h.body ? <p className="mt-3 max-w-56 text-sm text-asphalt-500">{h.body}</p> : null}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      ) : null}

      {/* Secteurs */}
      {items.SECTOR.length > 0 ? (
        <section className="site-blueprint-light bg-paper-deep">
          <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
            <SectionHeading index={next()} label="Pour qui" title={s["sectors.title"]} />
            <ul className="mt-10 flex flex-wrap gap-3">
              {items.SECTOR.map((sector) => (
                <li key={sector.id} className="flex items-center gap-3 border-2 border-asphalt bg-paper px-4 py-3 font-bold">
                  <SiteIcon name={sector.icon} className="h-5 w-5" />
                  {sector.title}
                </li>
              ))}
            </ul>
          </div>
        </section>
      ) : null}

      {/* Fonctionnalités */}
      {items.FEATURE.length > 0 ? (
        <section id="fonctionnalites" className="scroll-mt-20 bg-paper">
          <div className="mx-auto max-w-7xl px-4 py-24 sm:px-6">
            <SectionHeading index={next()} label="Fonctionnalités" title={s["features.title"]} text={s["features.subtitle"]} />
            <div className="mt-14 grid gap-px border-2 border-asphalt bg-asphalt sm:grid-cols-2 lg:grid-cols-3">
              {items.FEATURE.map((f, i) => (
                <article key={f.id} className="group bg-paper p-7 transition-colors hover:bg-white">
                  <div className="flex items-start justify-between">
                    <span className="flex h-12 w-12 items-center justify-center border-2 border-asphalt bg-signal transition-transform group-hover:-rotate-6">
                      <SiteIcon name={f.icon} className="h-6 w-6" />
                    </span>
                    <span className="font-plate text-sm text-asphalt-500">{String(i + 1).padStart(2, "0")}</span>
                  </div>
                  {f.meta ? <p className="site-label mt-6 text-[10px] text-asphalt-500">{f.meta}</p> : null}
                  <h3 className="mt-2 text-xl font-bold">{f.title}</h3>
                  {f.body ? <p className="mt-3 text-asphalt-500">{f.body}</p> : null}
                </article>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {/* Démarrage */}
      {items.STEP.length > 0 ? (
        <section id="demarrage" className="site-blueprint scroll-mt-20 bg-asphalt text-white">
          <div className="mx-auto max-w-7xl px-4 py-24 sm:px-6">
            <SectionHeading index={next()} label="Démarrage" title={s["steps.title"]} dark />
            <ol className="mt-14 grid gap-10 md:grid-cols-2 lg:grid-cols-4">
              {items.STEP.map((step, i) => (
                <li key={step.id} className="relative border-t-4 border-signal pt-6">
                  <p className="site-display text-7xl text-transparent [-webkit-text-stroke:2px_var(--color-signal)]">
                    {String(i + 1).padStart(2, "0")}
                  </p>
                  <h3 className="mt-4 text-xl font-bold">{step.title}</h3>
                  {step.body ? <p className="mt-2 text-white/70">{step.body}</p> : null}
                </li>
              ))}
            </ol>
          </div>
        </section>
      ) : null}

      {/* Calculateur */}
      {roi ? (
        <section id="calculateur" className="site-blueprint-light scroll-mt-20 bg-paper-deep">
          <div className="mx-auto max-w-7xl px-4 py-24 sm:px-6">
            <SectionHeading
              index={next()}
              label="Calculateur"
              title="Combien vous coûtent vos pannes ?"
              text="Ajustez les curseurs à votre parc : le calcul se fait sous vos yeux."
            />
            <div className="mt-12">
              <RoiCalculator
                reductionPct={settingNumber(s["roi.reductionPct"], 25)}
                pricePerEquipment={settingNumber(s["roi.pricePerEquipment"], 0)}
                currency={s["pricing.currency"] || "DT"}
              />
            </div>
          </div>
        </section>
      ) : null}

      {/* Tarifs */}
      {plans.length > 0 ? (
        <section id="tarifs" className="scroll-mt-20 bg-paper">
          <div className="mx-auto max-w-7xl px-4 py-24 sm:px-6">
            <SectionHeading index={next()} label="Tarifs" title={s["pricing.title"]} text={s["pricing.subtitle"]} />
            <div className="mt-12">
              <PricingPlans
                plans={plans}
                annualMonths={settingNumber(s["pricing.annualMonths"], 12)}
                annualLabel={s["pricing.annualLabel"]}
                currency={s["pricing.currency"] || "DT"}
              />
            </div>
          </div>
        </section>
      ) : null}

      {/* Témoignages */}
      {items.TESTIMONIAL.length > 0 ? (
        <section className="border-y-2 border-asphalt bg-signal">
          <div className="mx-auto max-w-7xl px-4 py-24 sm:px-6">
            <SectionHeading index={next()} label="Témoignages" title={s["testimonials.title"]} />
            <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {items.TESTIMONIAL.map((t) => (
                <figure key={t.id} className="flex flex-col border-2 border-asphalt bg-paper p-7 shadow-[6px_6px_0_var(--color-asphalt)]">
                  <Quote className="h-8 w-8" aria-hidden />
                  <blockquote className="mt-4 flex-1 text-lg">{t.body}</blockquote>
                  <figcaption className="mt-6 border-t-2 border-asphalt pt-4">
                    <p className="font-bold">{t.title}</p>
                    {t.meta ? <p className="site-label mt-1 text-[10px] text-asphalt-500">{t.meta}</p> : null}
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {/* Questions */}
      {items.FAQ.length > 0 ? (
        <section id="questions" className="scroll-mt-20 bg-paper">
          <div className="mx-auto grid max-w-7xl gap-12 px-4 py-24 sm:px-6 lg:grid-cols-[1fr_2fr]">
            <SectionHeading index={next()} label="Questions" title={s["faq.title"]} />
            <FaqList items={items.FAQ} />
          </div>
        </section>
      ) : null}

      <FinalCta title={s["cta.title"]} text={s["cta.text"]} cta={s["hero.ctaPrimary"]} />
    </SiteChrome>
  );
}
