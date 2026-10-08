import { Forbidden } from "@/components/forbidden";
import { ActionForm, Field, SubmitButton } from "@/components/forms/action-form";
import { PageHeader } from "@/components/layout/page-header";
import { Input, Select, Textarea } from "@/components/ui/inputs";
import { Card, CardBody } from "@/components/ui/primitives";
import { getAuthContext } from "@/server/auth/session";
import { isUuid } from "@/server/pages";
import { listEquipmentOptions } from "@/server/services/equipment";
import { listCostCenters, listSites } from "@/server/services/organization";
import { listPartOptions, listSupplierOptions } from "@/server/services/stock";
import { listWorkOrders } from "@/server/services/work-orders";
import { createPurchaseRequestAction } from "../actions";

export const metadata = { title: "Nouvelle demande d'achat" };

export default async function NewPurchaseRequestPage(props: PageProps<"/demandes-achat/nouvelle">) {
  const ctx = await getAuthContext();
  if (!ctx.can("purchase.create")) return <Forbidden what="la création de demandes d'achat" />;
  const sp = await props.searchParams;
  const workOrderId = isUuid(sp.workOrderId) ? sp.workOrderId : "";
  const [workOrders, equipment, costCenters, sites, parts, suppliers] = await Promise.all([
    listWorkOrders(ctx, { status: "OPEN", pageSize: 200 }),
    listEquipmentOptions(ctx, "purchase.create"),
    listCostCenters(ctx),
    listSites(ctx),
    listPartOptions(ctx),
    listSupplierOptions(ctx),
  ]);

  return (
    <>
      <PageHeader
        title="Nouvelle demande d'achat"
        description="Le montant estimé détermine les étapes de validation (responsable achats, puis direction au-delà du seuil)."
        back={{ href: "/demandes-achat", label: "Demandes d'achat" }}
      />
      <Card className="max-w-3xl">
        <CardBody>
          <ActionForm action={createPurchaseRequestAction} className="grid gap-5 sm:grid-cols-2">
            <Field label="Objet de la demande" name="description" required className="sm:col-span-2">
              <Textarea name="description" required rows={2} maxLength={300} />
            </Field>
            <Field
              label="Article du catalogue"
              name="partId"
              hint="Facultatif : prestation ou article hors catalogue sinon"
              className="sm:col-span-2"
            >
              <Select name="partId" placeholder="—" options={parts.map((p) => ({ value: p.id, label: `${p.sku} — ${p.name}` }))} />
            </Field>
            <Field label="Quantité" name="quantity" required>
              <Input name="quantity" type="number" min="0.001" step="any" required />
            </Field>
            <Field label="Prix unitaire estimé (€)" name="estimatedUnitPrice" required>
              <Input name="estimatedUnitPrice" type="number" min="0" step="0.01" required />
            </Field>
            <Field label="Fournisseur suggéré" name="supplierId">
              <Select name="supplierId" placeholder="—" options={suppliers.map((s) => ({ value: s.id, label: s.name }))} />
            </Field>
            <Field label="Date de besoin" name="neededBy">
              <Input name="neededBy" type="date" />
            </Field>
            <fieldset className="space-y-4 rounded-md border border-slate-200 p-4 sm:col-span-2">
              <legend className="px-1 text-sm font-medium text-slate-700">Rattachement (un au moins, ACH-01)</legend>
              <Field label="Ordre de travail" name="workOrderId">
                <Select
                  name="workOrderId"
                  defaultValue={workOrderId}
                  placeholder="—"
                  options={workOrders.items.map((w) => ({ value: w.id, label: `${w.number} — ${w.equipmentCode} — ${w.title}` }))}
                />
              </Field>
              <Field label="Équipement" name="equipmentId">
                <Select name="equipmentId" placeholder="—" options={equipment.map((e) => ({ value: e.id, label: `${e.code} — ${e.name}` }))} />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Centre de coût" name="costCenterId">
                  <Select name="costCenterId" placeholder="—" options={costCenters.map((c) => ({ value: c.id, label: `${c.code} — ${c.name}` }))} />
                </Field>
                <Field label="Site du besoin" name="siteId" hint="Avec un centre de coût seul">
                  <Select name="siteId" placeholder="—" options={sites.map((s) => ({ value: s.id, label: `${s.name} (${s.companyName})` }))} />
                </Field>
              </div>
            </fieldset>
            <div className="sm:col-span-2">
              <SubmitButton>Soumettre la demande</SubmitButton>
            </div>
          </ActionForm>
        </CardBody>
      </Card>
    </>
  );
}
