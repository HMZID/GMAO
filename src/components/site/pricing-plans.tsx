"use client";

import { Check } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { displayedPrice, planFeatures, type Billing } from "@/server/domain/site";
import { T, Tr } from "@/i18n/client";

export type PlanView = {
  id: string;
  name: string;
  tagline: string | null;
  priceMonthly: number | null;
  priceUnit: string | null;
  priceNote: string | null;
  features: string;
  ctaLabel: string | null;
  badge: string | null;
  highlighted: boolean;
};

const price = new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 0, maximumFractionDigits: 2 });

/** Offres, avec bascule paiement mensuel / annuel (avantage annuel réglé dans l'administration) ; devise du site (DT…). */
export function PricingPlans({
  plans,
  annualMonths,
  annualLabel,
  currency,
}: {
  plans: PlanView[];
  annualMonths: number;
  annualLabel: string;
  currency: string;
}) {
  const [billing, setBilling] = useState<Billing>("yearly");
  const hasPrices = plans.some((p) => p.priceMonthly !== null);
  return (
    <div>
      {hasPrices && annualMonths < 12 ? (
        <div className="mb-10 flex justify-center">
          <div role="radiogroup" aria-label="Facturation" className="inline-flex border-2 border-asphalt bg-paper p-1">
            {(
              [
                ["monthly", "Mensuel"],
                ["yearly", "Annuel"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={billing === value}
                onClick={() => setBilling(value)}
                className={`px-5 py-2 text-sm font-bold ${billing === value ? "bg-asphalt text-white" : "hover:bg-paper-deep"}`}
              >
                <Tr>{label}</Tr>
                {value === "yearly" && annualLabel ? (
                  <span
                    className={`site-label ms-2 px-1.5 py-0.5 text-[10px] ${billing === value ? "bg-signal text-asphalt" : "bg-asphalt text-signal"}`}
                  >
                    <Tr>{annualLabel}</Tr>
                  </span>
                ) : null}
              </button>
            ))}
          </div>
        </div>
      ) : null}
      <div className={`grid gap-6 ${plans.length >= 3 ? "lg:grid-cols-3" : plans.length === 2 ? "md:grid-cols-2" : ""}`}>
        {plans.map((plan) => {
          const amount = displayedPrice(plan.priceMonthly, billing, annualMonths);
          const dark = plan.highlighted;
          return (
            <article
              key={plan.id}
              className={`relative flex flex-col border-2 border-asphalt p-7 ${dark ? "bg-asphalt text-white shadow-[8px_8px_0_var(--color-signal)] lg:-translate-y-3" : "site-plate bg-paper"}`}
            >
              {plan.badge ? (
                <p className="site-label absolute -top-3.5 start-6 border-2 border-asphalt bg-signal px-2 py-1 text-[10px] text-asphalt">
                  <Tr>{plan.badge}</Tr>
                </p>
              ) : null}
              <h3 className="site-display text-3xl">
                <Tr>{plan.name}</Tr>
              </h3>
              {plan.tagline ? (
                <p className={`mt-2 text-sm ${dark ? "text-white/70" : "text-asphalt-500"}`}>
                  <Tr>{plan.tagline}</Tr>
                </p>
              ) : null}
              <div className="mt-6 min-h-24">
                {amount === null ? (
                  <p className="site-display text-5xl">
                    <Tr>{plan.priceUnit || "Sur devis"}</Tr>
                  </p>
                ) : (
                  <>
                    <p className="flex items-start gap-1">
                      <span className="site-display text-6xl">{price.format(amount)}</span>
                      <span className="site-display mt-1 text-2xl">
                        <Tr>{currency}</Tr>
                      </span>
                      {plan.priceMonthly !== null && amount < plan.priceMonthly ? (
                        <s className={`site-display ms-3 mt-1 text-2xl ${dark ? "text-white/40" : "text-asphalt-500/60"}`}>
                          <span className="sr-only">
                            <T>au lieu de</T>{" "}
                          </span>
                          {price.format(plan.priceMonthly)} <Tr>{currency}</Tr>
                        </s>
                      ) : null}
                    </p>
                    <p className={`text-sm ${dark ? "text-white/70" : "text-asphalt-500"}`}>
                      <Tr>{plan.priceUnit}</Tr>
                      <Tr>{billing === "yearly" && annualMonths < 12 ? " · facturé annuellement" : ""}</Tr>
                    </p>
                  </>
                )}
                {plan.priceNote ? (
                  <p className={`site-label mt-2 text-[10px] ${dark ? "text-signal" : "text-asphalt"}`}>
                    <Tr>{plan.priceNote}</Tr>
                  </p>
                ) : null}
              </div>
              <ul className="mt-6 flex-1 space-y-3 text-sm">
                {planFeatures(plan.features).map((f) =>
                  // Ligne terminée par « : » (« Tout Atelier, plus : ») : intertitre, sans coche.
                  f.endsWith(":") ? (
                    <li key={f} className={`site-label pt-1 text-[11px] ${dark ? "text-signal" : "text-asphalt-500"}`}>
                      <Tr>{f}</Tr>
                    </li>
                  ) : (
                    <li key={f} className="flex gap-2.5">
                      <Check className={`mt-0.5 h-4 w-4 shrink-0 ${dark ? "text-signal" : "text-asphalt"}`} aria-hidden />
                      <span>
                        <Tr>{f}</Tr>
                      </span>
                    </li>
                  ),
                )}
              </ul>
              <Link
                href={`/essai-gratuit?offre=${encodeURIComponent(plan.name)}`}
                className={`site-btn mt-8 w-full ${dark ? "site-btn-signal" : "bg-asphalt text-white hover:bg-asphalt-700"}`}
              >
                <Tr>{plan.ctaLabel || "Essayer gratuitement"}</Tr>
              </Link>
            </article>
          );
        })}
      </div>
    </div>
  );
}
