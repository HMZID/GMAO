"use client";

import Link from "next/link";
import { useId, useState } from "react";
import { estimateRoi } from "@/server/domain/site";

const euros = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
const decimal = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 });

type SliderProps = { label: string; value: number; min: number; max: number; step: number; unit: string; onChange: (v: number) => void };

function Slider({ label, value, min, max, step, unit, onChange }: SliderProps) {
  const id = useId();
  return (
    <div>
      <div className="flex items-baseline justify-between gap-4">
        <label htmlFor={id} className="text-sm font-semibold">
          {label}
        </label>
        <output htmlFor={id} className="font-plate text-lg font-bold tabular-nums">
          {decimal.format(value)} <span className="text-xs font-normal text-asphalt-500">{unit}</span>
        </output>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="site-range mt-2 w-full"
      />
    </div>
  );
}

/** Calculateur du coût des pannes : estimation indicative, selon les hypothèses du visiteur. */
export function RoiCalculator({ reductionPct, pricePerEquipment }: { reductionPct: number; pricePerEquipment: number }) {
  const [equipmentCount, setEquipmentCount] = useState(40);
  const [breakdownsPerMonth, setBreakdowns] = useState(6);
  const [daysPerBreakdown, setDays] = useState(2);
  const [dailyCost, setDailyCost] = useState(600);
  const r = estimateRoi({ equipmentCount, breakdownsPerMonth, daysPerBreakdown, dailyCost, reductionPct, pricePerEquipment });

  return (
    <div className="grid border-2 border-asphalt bg-paper lg:grid-cols-[1.1fr_1fr]">
      <div className="space-y-7 p-6 sm:p-8">
        <Slider label="Équipements suivis" value={equipmentCount} min={5} max={500} step={5} unit="engins" onChange={setEquipmentCount} />
        <Slider label="Pannes par mois (tout le parc)" value={breakdownsPerMonth} min={1} max={60} step={1} unit="pannes" onChange={setBreakdowns} />
        <Slider label="Immobilisation moyenne par panne" value={daysPerBreakdown} min={0.5} max={10} step={0.5} unit="jours" onChange={setDays} />
        <Slider
          label="Coût d'une journée d'immobilisation"
          value={dailyCost}
          min={100}
          max={3000}
          step={50}
          unit="€ (location, retard)"
          onChange={setDailyCost}
        />
      </div>
      <div className="site-blueprint flex flex-col justify-between gap-6 bg-asphalt p-6 text-white sm:p-8" aria-live="polite">
        <dl className="space-y-5">
          <div>
            <dt className="site-label text-[11px] text-white/60">Vos immobilisations coûtent aujourd&apos;hui</dt>
            <dd className="site-display mt-1 text-4xl text-white">{euros.format(r.downtimeCost)} / an</dd>
          </div>
          <div>
            <dt className="site-label text-[11px] text-white/60">Économie avec −{decimal.format(reductionPct)} % d&apos;immobilisation</dt>
            <dd className="site-display mt-1 text-5xl text-signal sm:text-6xl">{euros.format(r.savings)} / an</dd>
          </div>
          <div className="grid grid-cols-2 gap-4 border-t border-white/15 pt-4">
            <div>
              <dt className="site-label text-[10px] text-white/60">Abonnement estimé</dt>
              <dd className="font-plate mt-1 text-lg font-bold">{euros.format(r.subscription)} / an</dd>
            </div>
            <div>
              <dt className="site-label text-[10px] text-white/60">Retour sur investissement</dt>
              <dd className="font-plate mt-1 text-lg font-bold">{r.paybackMonths === null ? "—" : `${decimal.format(r.paybackMonths)} mois`}</dd>
            </div>
          </div>
        </dl>
        <div>
          <Link href="/essai-gratuit" className="site-btn site-btn-signal w-full">
            Vérifier sur mon parc, gratuitement
          </Link>
          <p className="mt-3 text-xs text-white/50">
            Estimation indicative fondée sur vos hypothèses et sur une réduction de {decimal.format(reductionPct)} % des journées
            d&apos;immobilisation ; abonnement calculé à {euros.format(pricePerEquipment)} HT par équipement et par mois.
          </p>
        </div>
      </div>
    </div>
  );
}
