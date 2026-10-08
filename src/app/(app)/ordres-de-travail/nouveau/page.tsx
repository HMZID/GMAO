import { Forbidden } from "@/components/forbidden";
import { ActionForm, Field, SubmitButton } from "@/components/forms/action-form";
import { PageHeader } from "@/components/layout/page-header";
import { ButtonLink } from "@/components/ui/button";
import { Checkbox, Input, Select, Textarea } from "@/components/ui/inputs";
import { Card, CardBody } from "@/components/ui/primitives";
import { PRIORITY, WORK_ORDER_TYPE, options } from "@/lib/labels";
import { getAuthContext } from "@/server/auth/session";
import { isUuid } from "@/server/pages";
import { listEquipmentOptions } from "@/server/services/equipment";
import { listWorkshops } from "@/server/services/organization";
import { listSupplierOptions } from "@/server/services/stock";
import { listTechnicianOptions } from "@/server/services/work-orders";
import { createWorkOrderAction } from "../actions";

export const metadata = { title: "Nouvel ordre de travail" };

export default async function NewWorkOrderPage(props: PageProps<"/ordres-de-travail/nouveau">) {
  const ctx = await getAuthContext();
  if (!ctx.can("workorder.create")) return <Forbidden what="la création d'OT" />;
  const sp = await props.searchParams;
  const preselected = isUuid(sp.equipmentId) ? sp.equipmentId : "";
  const [equipment, workshops, technicians, suppliers] = await Promise.all([
    listEquipmentOptions(ctx, "workorder.create"),
    listWorkshops(ctx),
    listTechnicianOptions(ctx),
    listSupplierOptions(ctx),
  ]);

  return (
    <>
      <PageHeader
        title="Nouvel ordre de travail"
        description="Pour une panne signalée, préférer la transformation de la DI. Un OT correctif « immobilisant » rend l'équipement inapte jusqu'à la remise en service."
        back={{ href: "/ordres-de-travail", label: "Ordres de travail" }}
      />
      <Card className="max-w-4xl">
        <CardBody>
          <ActionForm action={createWorkOrderAction} className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Équipement" name="equipmentId" required className="sm:col-span-2">
                <Select
                  id="equipmentId"
                  name="equipmentId"
                  required
                  defaultValue={preselected}
                  placeholder="Choisir l'équipement…"
                  options={equipment.map((e) => ({ value: e.id, label: `${e.code} — ${e.name}` }))}
                />
              </Field>
              <Field label="Intitulé" name="title" required className="sm:col-span-2">
                <Input id="title" name="title" required maxLength={200} />
              </Field>
              <Field label="Type" name="type">
                <Select id="type" name="type" defaultValue="CORRECTIVE" options={options(WORK_ORDER_TYPE)} />
              </Field>
              <Field label="Priorité" name="priority">
                <Select id="priority" name="priority" defaultValue="P3" options={options(PRIORITY)} />
              </Field>
              <Field label="Description" name="description" className="sm:col-span-2">
                <Textarea id="description" name="description" rows={3} maxLength={4000} />
              </Field>
              <div className="flex flex-wrap gap-6 sm:col-span-2">
                <Checkbox name="isImmobilizing" label="Immobilisant (équipement inapte)" />
                <Checkbox name="isSafetyRelated" label="Lié à la sécurité (remise en service validée)" />
                <Checkbox name="isExternal" label="Réalisé par un prestataire" />
              </div>
              <Field label="Prestataire" name="supplierId">
                <Select
                  id="supplierId"
                  name="supplierId"
                  placeholder="—"
                  options={suppliers.filter((s) => s.isContractor).map((s) => ({ value: s.id, label: s.name }))}
                />
              </Field>
              <Field label="Atelier" name="workshopId">
                <Select
                  id="workshopId"
                  name="workshopId"
                  placeholder="—"
                  options={workshops.map((w) => ({ value: w.id, label: `${w.name} — ${w.siteName}` }))}
                />
              </Field>
              <Field label="Début prévu" name="plannedStart">
                <Input id="plannedStart" name="plannedStart" type="datetime-local" />
              </Field>
              <Field label="Durée estimée (minutes)" name="estimatedMinutes">
                <Input id="estimatedMinutes" name="estimatedMinutes" type="number" min={1} />
              </Field>
            </div>
            <fieldset>
              <legend className="mb-2 text-sm font-medium text-slate-700">Intervenants</legend>
              <div className="grid gap-2 sm:grid-cols-3">
                {technicians.map((t) => (
                  <Checkbox key={t.id} name="assigneeIds[]" value={t.id} label={`${t.firstName} ${t.lastName}`} />
                ))}
              </div>
            </fieldset>
            <div className="flex items-center gap-3 border-t border-slate-100 pt-5">
              <SubmitButton>Créer l&apos;OT</SubmitButton>
              <ButtonLink href="/ordres-de-travail" variant="ghost">
                Annuler
              </ButtonLink>
            </div>
          </ActionForm>
        </CardBody>
      </Card>
    </>
  );
}
