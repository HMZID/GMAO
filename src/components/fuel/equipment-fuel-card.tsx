import Link from "next/link";
import { fuelSettingsAction } from "@/app/(app)/carburant/actions";
import { ActionForm, Field, SubmitButton } from "@/components/forms/action-form";
import { Disclosure } from "@/components/ui/disclosure";
import { Input, Select } from "@/components/ui/inputs";
import { Card, CardBody, CardHeader, DescriptionList } from "@/components/ui/primitives";
import { formatCurrency, formatNumber } from "@/lib/format";
import { FLUID_KIND } from "@/lib/labels";
import type { AuthContext } from "@/server/authz/context";
import { getEquipmentFuel, listFuelCardOptions } from "@/server/services/fuel";
import { FuelEntriesTable } from "./fuel-entries-table";
import { FuelEntryForm } from "./fuel-entry-form";
import { T, Tr } from "@/i18n/client";
import { tpl } from "@/i18n/translate";

/** Carte « Carburant et fluides » de la fiche équipement : réglages, consommation sur 90 jours, derniers pleins, saisie. */
export async function EquipmentFuelCard({ ctx, equipmentId, now }: { ctx: AuthContext; equipmentId: string; now: Date }) {
  if (!ctx.can("fuel.read")) return null;
  const fuel = await getEquipmentFuel(ctx, equipmentId, now);
  const cards = fuel.canWrite ? await listFuelCardOptions(ctx, fuel.equipment.companyId) : [];
  const c = fuel.consumption;
  const unit = fuel.unit ?? "";

  return (
    <Card>
      <CardHeader
        title="Carburant et fluides"
        description="Consommation des 90 derniers jours, de plein complet à plein complet"
        actions={
          <Link href="/carburant" className="text-sm text-brand-700 hover:underline">
            <T>Tout le parc</T>
          </Link>
        }
      />
      <CardBody>
        <DescriptionList
          columns={3}
          items={[
            { label: "Consommation", value: c?.rate != null ? formatNumber(c.rate, unit) : "—" },
            {
              label: "Référence",
              value:
                c?.reference != null
                  ? formatNumber(c.reference, unit)
                  : fuel.settings.referenceConsumption
                    ? formatNumber(fuel.settings.referenceConsumption, unit)
                    : "—",
            },
            { label: "Écart", value: c?.deviation != null ? `${c.deviation > 0 ? "+" : ""}${formatNumber(c.deviation)} %` : "—" },
            { label: "Carburant", value: c ? formatNumber(c.fuelLitres, "L") : "—" },
            { label: "Montant", value: c ? formatCurrency(c.amount) : "—" },
            {
              label: "Réglages",
              value: (
                <>
                  {fuel.settings.fuelType ? <Tr>{FLUID_KIND[fuel.settings.fuelType]}</Tr> : "—"}
                  {fuel.settings.tankCapacity ? ` · ${formatNumber(fuel.settings.tankCapacity, "L")}` : ""}
                </>
              ),
            },
          ]}
        />
        {fuel.cards.length > 0 ? (
          <p className="mt-3 text-xs text-slate-500">
            <T>Cartes affectées</T> : {fuel.cards.map((card) => `${card.provider} …${card.last4}`).join(", ")}
          </p>
        ) : null}
        {fuel.unit === null ? (
          <p className="mt-3 text-xs text-slate-500">
            <T>Sans compteur d&apos;heures ou de kilomètres, la consommation n&apos;est pas calculée.</T>
          </p>
        ) : null}
      </CardBody>
      <FuelEntriesTable items={fuel.recent} ctx={ctx} emptyText="Aucun plein enregistré pour cet équipement." />
      {fuel.canWrite || fuel.canManage ? (
        <CardBody className="space-y-3 border-t border-slate-100">
          {fuel.canWrite ? (
            <Disclosure summary="Saisir un plein">
              <FuelEntryForm
                equipmentId={equipmentId}
                cards={cards}
                meterUnit={fuel.meter?.unit}
                defaultFluid={fuel.settings.fuelType ?? "DIESEL"}
                now={now}
              />
            </Disclosure>
          ) : null}
          {fuel.canManage ? (
            <Disclosure summary="Réglages carburant">
              <ActionForm action={fuelSettingsAction.bind(null, equipmentId)} className="grid gap-4 sm:grid-cols-3">
                <Field label="Carburant" name="fuelType">
                  <Select
                    name="fuelType"
                    placeholder="—"
                    defaultValue={fuel.settings.fuelType ?? ""}
                    options={[
                      { value: "DIESEL", label: "Gasoil" },
                      { value: "GASOLINE", label: "Essence" },
                    ]}
                  />
                </Field>
                <Field label="Réservoir (L)" name="tankCapacity">
                  <Input name="tankCapacity" type="number" min="1" step="1" defaultValue={fuel.settings.tankCapacity ?? ""} />
                </Field>
                <Field
                  label="Consommation de référence"
                  name="referenceConsumption"
                  hint={unit ? tpl`En ${unit}, constructeur ou contrat ; vide : médiane des pleins` : "Vide : médiane des pleins"}
                >
                  <Input name="referenceConsumption" type="number" min="0.1" step="0.1" defaultValue={fuel.settings.referenceConsumption ?? ""} />
                </Field>
                <div className="sm:col-span-3">
                  <SubmitButton>
                    <T>Enregistrer les réglages</T>
                  </SubmitButton>
                </div>
              </ActionForm>
            </Disclosure>
          ) : null}
        </CardBody>
      ) : null}
    </Card>
  );
}
