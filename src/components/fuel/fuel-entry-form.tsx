import { recordFuelAction } from "@/app/(app)/carburant/actions";
import { ActionForm, Field, SubmitButton } from "@/components/forms/action-form";
import { Input, Select } from "@/components/ui/inputs";
import { toDateTimeInput } from "@/lib/format";
import { FLUID_KIND, options } from "@/lib/labels";
import { T } from "@/i18n/client";
import { tpl } from "@/i18n/translate";

type CardOption = { id: string; provider: string; last4: string; label: string | null; equipmentId: string | null };

/**
 * Saisie d'un plein ou d'un appoint. Sur la fiche équipement, l'équipement est imposé ; sur la page Carburant, il se
 * choisit. Le compteur relevé au plein sert au calcul de la consommation (plein complet).
 */
export function FuelEntryForm({
  equipmentId,
  equipmentOptions = [],
  cards,
  meterUnit,
  defaultFluid = "DIESEL",
  now,
}: {
  equipmentId?: string;
  equipmentOptions?: { id: string; code: string; name: string }[];
  cards: CardOption[];
  meterUnit?: string | null;
  defaultFluid?: string;
  /** Heure proposée par défaut (lue après l'accès à la session). */
  now: Date;
}) {
  // La carte affectée à l'équipement est proposée en premier.
  const sortedCards = [...cards].sort((a, b) => Number(b.equipmentId === equipmentId) - Number(a.equipmentId === equipmentId));
  return (
    <ActionForm action={recordFuelAction.bind(null, equipmentId ?? null)} resetOnSuccess className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {equipmentId ? null : (
        <Field label="Équipement" name="equipmentId" required className="sm:col-span-2">
          <Select
            name="equipmentId"
            required
            placeholder="Choisir l'équipement…"
            options={equipmentOptions.map((e) => ({ value: e.id, label: `${e.code} — ${e.name}` }))}
          />
        </Field>
      )}
      <Field label="Produit" name="fluid" required>
        <Select name="fluid" required defaultValue={defaultFluid} options={options(FLUID_KIND)} />
      </Field>
      <Field label="Quantité (L)" name="quantity" required>
        <Input name="quantity" type="number" min="0.01" step="0.01" required inputMode="decimal" />
      </Field>
      <Field label="Prix au litre" name="unitPrice" hint="3 décimales possibles">
        <Input name="unitPrice" type="number" min="0" step="0.001" inputMode="decimal" />
      </Field>
      <Field label="Montant" name="amount" hint="Vide : quantité × prix">
        <Input name="amount" type="number" min="0" step="0.01" inputMode="decimal" />
      </Field>
      <Field label="Compteur" name="meterValue" hint={meterUnit ? tpl`Relevé en ${meterUnit} au moment du plein` : "Relevé au moment du plein"}>
        <Input name="meterValue" type="number" min="0" step="0.1" inputMode="decimal" />
      </Field>
      <Field label="Plein complet" name="fullTank" hint="Non : appoint (la consommation se calcule entre deux pleins complets)">
        <Select
          name="fullTank"
          defaultValue="true"
          options={[
            { value: "true", label: "Oui" },
            { value: "false", label: "Non" },
          ]}
        />
      </Field>
      <Field label="Date et heure" name="filledAt">
        <Input name="filledAt" type="datetime-local" defaultValue={toDateTimeInput(now)} />
      </Field>
      <Field label="Carte carburant" name="fuelCardId">
        <Select
          name="fuelCardId"
          placeholder="Sans carte"
          options={sortedCards.map((c) => ({ value: c.id, label: `${c.provider} …${c.last4}${c.label ? ` — ${c.label}` : ""}` }))}
        />
      </Field>
      <Field label="Station" name="station">
        <Input name="station" maxLength={120} />
      </Field>
      <Field label="Référence" name="reference" hint="N° de ticket ou de bon">
        <Input name="reference" maxLength={80} />
      </Field>
      <div className="flex items-end sm:col-span-2 lg:col-span-4">
        <SubmitButton>
          <T>Enregistrer le plein</T>
        </SubmitButton>
      </div>
    </ActionForm>
  );
}
