import { ActionForm, Field, SubmitButton } from "@/components/forms/action-form";
import { ButtonLink } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/inputs";
import { toDateInput } from "@/lib/format";
import { ACQUISITION_MODE, METER_TYPE, options } from "@/lib/labels";
import type { ActionState } from "@/lib/action-state";

type Opt = { id: string; label: string };

export type EquipmentFormValues = {
  companyId?: string;
  siteId?: string;
  categoryId?: string;
  modelId?: string | null;
  code?: string;
  name?: string;
  manufacturer?: string;
  serialNumber?: string | null;
  registration?: string | null;
  year?: number | null;
  criticality?: string | null;
  acquisitionMode?: string;
  acquisitionDate?: Date | null;
  acquisitionValue?: number | null;
  commissioningDate?: Date | null;
  warrantyEndDate?: Date | null;
  warrantyEndMeter?: number | null;
  notes?: string | null;
};

/**
 * Formulaire de fiche équipement (EQP-01, EQP-02), commun à la création et à la modification.
 * À la création : société propriétaire et compteur principal ; la criticité vide hérite de la catégorie (EQP-06).
 */
export function EquipmentForm({
  action,
  mode,
  values = {},
  companies,
  sites,
  categories,
  models,
  cancelHref,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  mode: "create" | "edit";
  values?: EquipmentFormValues;
  companies: Opt[];
  sites: (Opt & { companyId: string })[];
  categories: Opt[];
  models: (Opt & { categoryId: string })[];
  cancelHref: string;
}) {
  const siteOptions = (mode === "edit" && values.companyId ? sites.filter((s) => s.companyId === values.companyId) : sites).map((s) => ({
    value: s.id,
    label: s.label,
  }));
  return (
    <ActionForm action={action} className="space-y-8">
      <fieldset className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <legend className="mb-3 text-sm font-semibold text-slate-900">Identification</legend>
        <Field label="Code parc" name="code" required hint="Unique dans le groupe, ex. CH-012">
          <Input id="code" name="code" defaultValue={values.code} required maxLength={40} />
        </Field>
        <Field label="Désignation" name="name" required className="lg:col-span-2">
          <Input id="name" name="name" defaultValue={values.name} required maxLength={160} />
        </Field>
        <Field label="Catégorie" name="categoryId" required>
          <Select
            id="categoryId"
            name="categoryId"
            defaultValue={values.categoryId ?? ""}
            placeholder="Choisir…"
            required
            options={categories.map((c) => ({ value: c.id, label: c.label }))}
          />
        </Field>
        <Field label="Modèle" name="modelId" hint="Facultatif : permet d'appliquer les plans du modèle">
          <Select
            id="modelId"
            name="modelId"
            defaultValue={values.modelId ?? ""}
            placeholder="Aucun"
            options={models.map((m) => ({ value: m.id, label: m.label }))}
          />
        </Field>
        <Field label="Marque" name="manufacturer" required>
          <Input id="manufacturer" name="manufacturer" defaultValue={values.manufacturer} required maxLength={80} />
        </Field>
        <Field label="Numéro de série" name="serialNumber" required hint="Doublon marque + n° de série refusé">
          <Input id="serialNumber" name="serialNumber" defaultValue={values.serialNumber ?? ""} required maxLength={80} />
        </Field>
        <Field label="Immatriculation" name="registration">
          <Input id="registration" name="registration" defaultValue={values.registration ?? ""} maxLength={30} />
        </Field>
        <Field label="Année" name="year">
          <Input id="year" name="year" type="number" min={1950} max={2100} defaultValue={values.year ?? ""} />
        </Field>
        <Field label="Criticité" name="criticality" hint={mode === "create" ? "Vide : héritée de la catégorie" : undefined}>
          <Select
            id="criticality"
            name="criticality"
            defaultValue={values.criticality ?? ""}
            placeholder={mode === "create" ? "Selon la catégorie" : undefined}
            options={[
              { value: "A", label: "A — critique (urgence relevée d'un niveau)" },
              { value: "B", label: "B — importante" },
              { value: "C", label: "C — secondaire" },
            ]}
          />
        </Field>
      </fieldset>

      <fieldset className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <legend className="mb-3 text-sm font-semibold text-slate-900">Rattachement</legend>
        {mode === "create" ? (
          <Field label="Société propriétaire" name="companyId" required>
            <Select
              id="companyId"
              name="companyId"
              defaultValue={values.companyId ?? ""}
              placeholder="Choisir…"
              required
              options={companies.map((c) => ({ value: c.id, label: c.label }))}
            />
          </Field>
        ) : null}
        <Field label="Site de rattachement" name="siteId" required hint="Le site doit appartenir à la société">
          <Select id="siteId" name="siteId" defaultValue={values.siteId ?? ""} placeholder="Choisir…" required options={siteOptions} />
        </Field>
      </fieldset>

      <fieldset className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <legend className="mb-3 text-sm font-semibold text-slate-900">Acquisition et garantie</legend>
        <Field label="Mode d'acquisition" name="acquisitionMode">
          <Select
            id="acquisitionMode"
            name="acquisitionMode"
            defaultValue={values.acquisitionMode ?? "PURCHASE"}
            options={options(ACQUISITION_MODE)}
          />
        </Field>
        <Field label="Date d'acquisition" name="acquisitionDate">
          <Input id="acquisitionDate" name="acquisitionDate" type="date" defaultValue={toDateInput(values.acquisitionDate)} />
        </Field>
        <Field label="Valeur d'acquisition (€ HT)" name="acquisitionValue">
          <Input id="acquisitionValue" name="acquisitionValue" type="number" min={0} step="0.01" defaultValue={values.acquisitionValue ?? ""} />
        </Field>
        <Field label="Mise en service" name="commissioningDate" required>
          <Input id="commissioningDate" name="commissioningDate" type="date" required defaultValue={toDateInput(values.commissioningDate)} />
        </Field>
        <Field label="Fin de garantie" name="warrantyEndDate">
          <Input id="warrantyEndDate" name="warrantyEndDate" type="date" defaultValue={toDateInput(values.warrantyEndDate)} />
        </Field>
        <Field label="Garantie jusqu'au compteur" name="warrantyEndMeter">
          <Input id="warrantyEndMeter" name="warrantyEndMeter" type="number" min={0} defaultValue={values.warrantyEndMeter ?? ""} />
        </Field>
      </fieldset>

      {mode === "create" ? (
        <fieldset className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <legend className="mb-3 text-sm font-semibold text-slate-900">Compteur principal</legend>
          <Field label="Type de compteur" name="primaryMeterType" hint="Vide : équipement sans compteur (préventif calendaire seulement)">
            <Select id="primaryMeterType" name="primaryMeterType" defaultValue="HOURS" placeholder="Aucun compteur" options={options(METER_TYPE)} />
          </Field>
          <Field label="Valeur actuelle" name="primaryMeterValue">
            <Input id="primaryMeterValue" name="primaryMeterValue" type="number" min={0} step="0.1" defaultValue={0} />
          </Field>
        </fieldset>
      ) : null}

      <Field label="Notes" name="notes">
        <Textarea id="notes" name="notes" defaultValue={values.notes ?? ""} rows={3} maxLength={2000} />
      </Field>

      <div className="flex items-center gap-3 border-t border-slate-100 pt-6">
        <SubmitButton>{mode === "create" ? "Créer l'équipement" : "Enregistrer"}</SubmitButton>
        <ButtonLink href={cancelHref} variant="ghost">
          Annuler
        </ButtonLink>
      </div>
    </ActionForm>
  );
}
