"use client";

import { useState } from "react";
import { ActionForm, Field, SubmitButton } from "@/components/forms/action-form";
import { Input, Select } from "@/components/ui/inputs";
import { createIndicatorAction } from "../actions";
import { T } from "@/i18n/client";

type Option = { value: string; label: string };
export type SourceOption = {
  value: string;
  label: string;
  fields: Option[];
  dimensions: (Option & { choices: Option[] | null })[];
};

const AGGREGATES: Option[] = [
  { value: "count", label: "Nombre" },
  { value: "sum", label: "Total d'un champ" },
  { value: "avg", label: "Moyenne d'un champ" },
];
const CHARTS: Option[] = [
  { value: "number", label: "Valeur unique" },
  { value: "bar", label: "Barres" },
  { value: "table", label: "Tableau" },
];
const PERIODS: Option[] = [
  { value: "7", label: "7 derniers jours" },
  { value: "30", label: "30 derniers jours" },
  { value: "90", label: "90 derniers jours" },
  { value: "365", label: "12 derniers mois" },
];

/**
 * Composition d'un indicateur : les listes (champs, regroupements, filtres) suivent la source choisie.
 * Le serveur contrôle à nouveau la définition complète.
 */
export function IndicatorForm({ sources }: { sources: SourceOption[] }) {
  const [sourceKey, setSourceKey] = useState(sources[0]?.value ?? "");
  const [aggregate, setAggregate] = useState("count");
  const [chart, setChart] = useState("bar");
  const [filterKey, setFilterKey] = useState("");
  const source = sources.find((s) => s.value === sourceKey) ?? sources[0];
  const filterable = source.dimensions.filter((d) => d.choices);
  const filter = filterable.find((d) => d.value === filterKey);
  const aggregates = source.fields.length > 0 ? AGGREGATES : AGGREGATES.slice(0, 1);

  return (
    <ActionForm action={createIndicatorAction} resetOnSuccess className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <Field label="Nom de l'indicateur" name="name" required className="sm:col-span-2 lg:col-span-3">
        <Input name="name" required maxLength={80} placeholder="Ex. : Interventions correctives par site" />
      </Field>
      <Field label="Données" name="source" required>
        <Select
          name="source"
          required
          value={sourceKey}
          onChange={(e) => {
            setSourceKey(e.target.value);
            setAggregate("count");
            setFilterKey("");
          }}
          options={sources.map(({ value, label }) => ({ value, label }))}
        />
      </Field>
      <Field label="Mesure" name="aggregate" required>
        <Select name="aggregate" required value={aggregate} onChange={(e) => setAggregate(e.target.value)} options={aggregates} />
      </Field>
      {aggregate !== "count" ? (
        <Field label="Champ" name="field" required>
          <Select key={sourceKey} name="field" required options={source.fields} />
        </Field>
      ) : (
        <input type="hidden" name="field" value="" />
      )}
      <Field label="Présentation" name="chart" required>
        <Select name="chart" required value={chart} onChange={(e) => setChart(e.target.value)} options={CHARTS} />
      </Field>
      {chart !== "number" ? (
        <Field label="Regroupé par" name="groupBy" required>
          <Select key={sourceKey} name="groupBy" required options={source.dimensions.map(({ value, label }) => ({ value, label }))} />
        </Field>
      ) : (
        <input type="hidden" name="groupBy" value="" />
      )}
      <Field label="Période" name="periodDays">
        <Select name="periodDays" placeholder="Toute la période" options={PERIODS} />
      </Field>
      <Field label="Filtrer sur" name="filterKey">
        <Select
          key={sourceKey}
          name="filterKey"
          value={filterKey}
          onChange={(e) => setFilterKey(e.target.value)}
          placeholder="Aucun filtre"
          options={filterable.map(({ value, label }) => ({ value, label }))}
        />
      </Field>
      {filter ? (
        <Field label={filter.label} name="filterValue" required>
          <Select key={filter.value} name="filterValue" required options={filter.choices ?? []} />
        </Field>
      ) : (
        <input type="hidden" name="filterValue" value="" />
      )}
      <div className="flex items-end sm:col-span-2 lg:col-span-3">
        <SubmitButton>
          <T>Ajouter l&apos;indicateur</T>
        </SubmitButton>
      </div>
    </ActionForm>
  );
}
