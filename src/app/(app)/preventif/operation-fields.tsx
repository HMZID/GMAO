import { Field } from "@/components/forms/action-form";
import { Checkbox, Input, Select, Textarea } from "@/components/ui/inputs";
import { CALENDAR_UNIT, METER_TYPE, OPERATION_MODE, options } from "@/lib/labels";

/** Champs d'une opération de maintenance (PRV-02, PRV-03) : déclencheurs au premier seuil atteint. */
export function OperationFields() {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Code" name="code" required hint="Ex. ENT-250">
          <Input id="code" name="code" required maxLength={30} />
        </Field>
        <Field label="Libellé" name="name" required className="sm:col-span-2">
          <Input id="op-name" name="name" required maxLength={160} placeholder="Ex. Entretien 250 h ou 3 mois" />
        </Field>
      </div>
      <Field
        label="Déclencheurs (au premier seuil atteint)"
        name="triggers"
        hint="Renseigner l'intervalle calendaire, l'intervalle compteur, ou les deux."
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-600">Tous les</span>
            <Input name="calendarEvery" type="number" min={1} className="w-24" aria-label="Intervalle calendaire" />
            <Select
              name="calendarUnit"
              defaultValue="MONTH"
              className="w-32"
              aria-label="Unité calendaire"
              options={Object.entries(CALENDAR_UNIT).map(([value, v]) => ({ value, label: v.many }))}
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-600">ou tous les</span>
            <Input name="meterEvery" type="number" min={1} className="w-28" aria-label="Intervalle compteur" />
            <Select name="meterType" defaultValue="HOURS" className="w-40" aria-label="Type de compteur" options={options(METER_TYPE)} />
          </div>
        </div>
      </Field>
      <div className="grid gap-4 sm:grid-cols-4">
        <Field label="Mode" name="mode" hint="Glissant : à partir de la réalisation">
          <Select id="mode" name="mode" defaultValue="SLIDING" options={options(OPERATION_MODE)} />
        </Field>
        <Field label="Pré-alerte (jours)" name="preAlertDays">
          <Input id="preAlertDays" name="preAlertDays" type="number" min={0} defaultValue={15} />
        </Field>
        <Field label="Pré-alerte (compteur)" name="preAlertMeter">
          <Input id="preAlertMeter" name="preAlertMeter" type="number" min={0} />
        </Field>
        <Field label="Tolérance (%)" name="tolerancePercent">
          <Input id="tolerancePercent" name="tolerancePercent" type="number" min={0} max={100} defaultValue={10} />
        </Field>
        <Field label="Durée estimée (min)" name="estimatedMinutes">
          <Input id="estimatedMinutes" name="estimatedMinutes" type="number" min={1} />
        </Field>
      </div>
      <div className="flex flex-wrap gap-6">
        <Checkbox name="isRegulatory" label="Contrôle réglementaire (report au-delà de l'échéance légale interdit)" />
        <Checkbox name="blockWhenOverdue" label="Bloquer l'équipement si échu (PRV-12)" />
      </div>
      <Field label="Checklist" name="checklist" hint="Un point par ligne ; chaque point devient obligatoire sur l'OT.">
        <Textarea
          id="checklist"
          name="checklist"
          rows={5}
          placeholder={"Vidange huile moteur\nRemplacement filtre à huile\nGraissage des articulations"}
        />
      </Field>
    </div>
  );
}
