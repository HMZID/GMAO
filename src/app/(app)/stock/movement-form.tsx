import { ActionForm, Field, SubmitButton } from "@/components/forms/action-form";
import { Input, Select } from "@/components/ui/inputs";
import { MANUAL_MOVEMENT, options } from "@/lib/labels";
import { movementAction } from "./actions";

type Opt = { id: string; label: string };

/**
 * Mouvement manuel (STK-04) : réception, transfert, ajustement d'inventaire signé, mise au rebut.
 * Les sorties sur OT et les retours se font depuis l'OT, pour l'imputation des coûts.
 */
export function MovementForm({
  parts,
  warehouses,
  suppliers,
  types,
  defaultPartId,
}: {
  parts: Opt[];
  warehouses: Opt[];
  suppliers: Opt[];
  types: string[];
  defaultPartId?: string;
}) {
  const typeOptions = options(MANUAL_MOVEMENT).filter((o) => types.includes(o.value));
  return (
    <ActionForm action={movementAction} resetOnSuccess className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <Field label="Type de mouvement" name="type" required>
        <Select id="mv-type" name="type" defaultValue={typeOptions[0]?.value} options={typeOptions} />
      </Field>
      <Field label="Article" name="partId" required className="lg:col-span-2">
        <Select
          id="mv-part"
          name="partId"
          required
          defaultValue={defaultPartId ?? ""}
          placeholder="Choisir…"
          options={parts.map((p) => ({ value: p.id, label: p.label }))}
        />
      </Field>
      <Field label="Magasin" name="warehouseId" required>
        <Select id="mv-wh" name="warehouseId" required placeholder="Choisir…" options={warehouses.map((w) => ({ value: w.id, label: w.label }))} />
      </Field>
      <Field label="Quantité" name="quantity" required hint="Ajustement : écart signé, ex. -3">
        <Input id="mv-qty" name="quantity" type="number" step="any" required />
      </Field>
      <Field label="Magasin de destination" name="targetWarehouseId" hint="Transfert uniquement">
        <Select id="mv-target" name="targetWarehouseId" placeholder="—" options={warehouses.map((w) => ({ value: w.id, label: w.label }))} />
      </Field>
      <Field label="Coût unitaire HT (€)" name="unitCost" hint="Réception : prix d'achat ; vide = coût moyen actuel">
        <Input id="mv-cost" name="unitCost" type="number" min={0} step="0.01" />
      </Field>
      <Field label="Fournisseur" name="supplierId" hint="Réception">
        <Select id="mv-supplier" name="supplierId" placeholder="—" options={suppliers.map((s) => ({ value: s.id, label: s.label }))} />
      </Field>
      <Field label="Référence" name="reference" hint="N° de bon de livraison, d'inventaire…">
        <Input id="mv-ref" name="reference" maxLength={80} />
      </Field>
      <Field label="Motif" name="reason" className="sm:col-span-2" hint="Obligatoire pour un ajustement ou une mise au rebut">
        <Input id="mv-reason" name="reason" maxLength={500} />
      </Field>
      <div className="flex items-end">
        <SubmitButton>Enregistrer le mouvement</SubmitButton>
      </div>
    </ActionForm>
  );
}
