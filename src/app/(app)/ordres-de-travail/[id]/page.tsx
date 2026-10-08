import Link from "next/link";
import { ActionForm, SubmitButton } from "@/components/forms/action-form";
import { DocumentsCard } from "@/components/documents/documents-card";
import { PageHeader } from "@/components/layout/page-header";
import { CriticalityBadge, EquipmentStatusBadge, PriorityBadge, RequestStatusBadge, WorkOrderStatusBadge } from "@/components/status-badges";
import { Alert, Badge, Card, CardBody, CardHeader, DescriptionList } from "@/components/ui/primitives";
import { formatDate, formatDateTime, formatMinutes, formatNumber } from "@/lib/format";
import { HOLD_REASON, WORK_ORDER_OUTCOME, WORK_ORDER_TYPE } from "@/lib/labels";
import { getAuthContext } from "@/server/auth/session";
import { OPEN_STATUSES } from "@/server/domain/work-order-status";
import { loadOr404 } from "@/server/pages";
import { listWarehouses, listWorkshops } from "@/server/services/organization";
import { listPartOptions, listSupplierOptions } from "@/server/services/stock";
import { getWorkOrder, listTechnicianOptions } from "@/server/services/work-orders";
import { recurrenceAction } from "../actions";
import { ChecklistCard, CostsCard, HistoryCard, PartsCard, PlanningCard, ReportCard, TimeCard, TransitionsCard } from "./sections";

export const metadata = { title: "Ordre de travail" };

export default async function WorkOrderPage(props: PageProps<"/ordres-de-travail/[id]">) {
  const { id } = await props.params;
  const ctx = await getAuthContext();
  const wo = await loadOr404(id, (x) => getWorkOrder(ctx, x));

  const status = wo.status;
  const isOpen = (OPEN_STATUSES as readonly string[]).includes(status);
  const plannable = wo.canManage && ["CREATED", "PLANNED", "ON_HOLD", "IN_PROGRESS"].includes(status);
  const executing = wo.canExecute && ["IN_PROGRESS", "WORK_DONE"].includes(status);
  const canReserve = wo.canManage && ["CREATED", "PLANNED", "ON_HOLD", "IN_PROGRESS"].includes(status);
  const costEditable = wo.canManage && status !== "CLOSED" && status !== "CANCELLED";
  const needsParts = canReserve || executing;

  const [technicians, workshops, suppliers, parts, warehouses] = await Promise.all([
    wo.canManage && isOpen ? listTechnicianOptions(ctx) : Promise.resolve([]),
    plannable ? listWorkshops(ctx) : Promise.resolve([]),
    plannable || costEditable ? listSupplierOptions(ctx) : Promise.resolve([]),
    needsParts ? listPartOptions(ctx) : Promise.resolve([]),
    needsParts ? listWarehouses(ctx) : Promise.resolve([]),
  ]);
  const techOptions = technicians.map((t) => ({ id: t.id, label: `${t.firstName} ${t.lastName}`, siteId: t.siteId }));
  const supplierOptions = suppliers.map((s) => ({ id: s.id, label: `${s.name}${s.isContractor ? "" : " (fournisseur)"}` }));
  const reasonOfHold = wo.holdReason ? HOLD_REASON[wo.holdReason] : null;

  return (
    <>
      <PageHeader
        back={{ href: "/ordres-de-travail", label: "Ordres de travail" }}
        title={
          <span className="flex flex-wrap items-baseline gap-3">
            {wo.number}
            <span className="text-lg font-normal text-slate-600">{wo.title}</span>
          </span>
        }
        meta={
          <>
            <WorkOrderStatusBadge status={wo.status} />
            <PriorityBadge value={wo.priority} />
            <Badge>{WORK_ORDER_TYPE[wo.type] ?? wo.type}</Badge>
            {wo.isImmobilizing ? <Badge tone="red">Immobilisant</Badge> : null}
            {wo.isSafetyRelated ? <Badge tone="red">Sécurité</Badge> : null}
            {wo.isExternal ? <Badge tone="violet">Prestataire</Badge> : null}
            {wo.reopenCount > 0 ? <Badge tone="amber">Rouvert {wo.reopenCount} fois</Badge> : null}
          </>
        }
        actions={
          wo.canManage && (status === "TECH_CLOSED" || status === "CLOSED") ? (
            <ActionForm action={recurrenceAction.bind(null, wo.id)} showMessage>
              <SubmitButton variant="secondary">Créer un OT de récidive</SubmitButton>
            </ActionForm>
          ) : null
        }
      />

      <div className="mb-6 space-y-3">
        {status === "ON_HOLD" ? (
          <Alert tone="amber" title={`En attente${reasonOfHold ? ` : ${reasonOfHold}` : ""}`}>
            {wo.holdComment ?? "Reprendre l'OT dès que la cause de l'attente est levée."}
          </Alert>
        ) : null}
        {wo.requiresRelease && isOpen ? (
          <Alert tone="blue" title="Remise en service à valider (COR-12)">
            Équipement de criticité A ou intervention liée à la sécurité : la clôture technique est validée par une personne habilitée, différente de
            l&apos;exécutant.
          </Alert>
        ) : null}
        {status === "CANCELLED" ? (
          <Alert tone="amber" title={`Annulé le ${formatDate(wo.cancelledAt)}`}>
            {wo.cancelReason}
          </Alert>
        ) : null}
        {status === "TECH_CLOSED" || status === "CLOSED" ? (
          <Alert tone="green" title={`Clôturé techniquement le ${formatDateTime(wo.techClosedAt)}`}>
            Résultat : {wo.outcome ? WORK_ORDER_OUTCOME[wo.outcome] : "—"}
            {wo.releaseValidatedBy ? ` · remise en service validée par ${wo.releaseValidatedBy.name}` : ""}
            {wo.meterValueAtClose !== null ? ` · compteur à la clôture : ${formatNumber(wo.meterValueAtClose)}` : ""}
          </Alert>
        ) : null}
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          {wo.canManage || wo.canExecute ? <TransitionsCard wo={wo} /> : null}
          <ChecklistCard wo={wo} canFill={executing} canAdd={wo.canExecute && ["CREATED", "PLANNED", "ON_HOLD", "IN_PROGRESS"].includes(status)} />
          <TimeCard
            wo={wo}
            myTechnicianId={ctx.technicianId}
            canTimer={wo.canExecute && status === "IN_PROGRESS"}
            canManual={wo.canExecute && ["IN_PROGRESS", "WORK_DONE", "ON_HOLD"].includes(status) && (!!ctx.technicianId || wo.canManage)}
            technicians={wo.canManage ? techOptions : []}
          />
          <PartsCard
            wo={wo}
            canReserve={canReserve}
            canIssue={executing}
            parts={parts.map((p) => ({ id: p.id, label: `${p.sku} — ${p.name} (${p.unit})` }))}
            warehouses={warehouses.map((w) => ({ id: w.id, label: `${w.name} — ${w.siteName}` }))}
          />
          <ReportCard
            wo={wo}
            canReport={wo.canExecute && ["IN_PROGRESS", "WORK_DONE", "ON_HOLD"].includes(status)}
            canRead={executing && ctx.can("meter.write")}
          />
          <DocumentsCard
            ctx={ctx}
            entityType="WORK_ORDER"
            entityId={wo.id}
            description="Photos, rapports, devis et factures de l'intervention"
            now={new Date()}
          />
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Intervention" />
            <CardBody>
              <DescriptionList
                columns={1}
                items={[
                  {
                    label: "Équipement",
                    value: (
                      <span className="flex flex-wrap items-center gap-2">
                        <Link href={`/equipements/${wo.equipment.id}`} className="font-medium text-brand-700 hover:underline">
                          {wo.equipment.code}
                        </Link>
                        {wo.equipment.name}
                        <EquipmentStatusBadge status={wo.equipment.status} />
                        <CriticalityBadge value={wo.equipment.criticality} />
                      </span>
                    ),
                  },
                  { label: "Site", value: wo.site.name },
                  { label: "Atelier", value: wo.workshop?.name },
                  { label: "Chantier", value: wo.jobsite?.name },
                  { label: "Prestataire", value: wo.supplier?.name },
                  {
                    label: "Planifié",
                    value: wo.plannedStart
                      ? `${formatDateTime(wo.plannedStart)}${wo.plannedEnd ? ` → ${formatDateTime(wo.plannedEnd)}` : ""}`
                      : "À planifier",
                  },
                  { label: "Durée estimée", value: wo.estimatedMinutes ? formatMinutes(wo.estimatedMinutes) : null },
                  {
                    label: "Intervenants",
                    value: wo.assignees.length ? wo.assignees.map((a) => `${a.technician.firstName} ${a.technician.lastName}`).join(", ") : null,
                  },
                  { label: "Démarré le", value: wo.startedAt ? formatDateTime(wo.startedAt) : null },
                  { label: "Travaux terminés le", value: wo.workDoneAt ? formatDateTime(wo.workDoneAt) : null },
                  {
                    label: "Échéance préventive",
                    value: wo.dueItem
                      ? [
                          wo.dueItem.dueMeterValue !== null ? formatNumber(wo.dueItem.dueMeterValue) : null,
                          wo.dueItem.dueDate ? formatDate(wo.dueItem.dueDate) : null,
                        ]
                          .filter(Boolean)
                          .join(" ou ")
                      : null,
                  },
                  {
                    label: "Origine",
                    value: wo.requests.length ? (
                      <span className="flex flex-col gap-1">
                        {wo.requests.map((r) => (
                          <span key={r.id} className="flex items-center gap-2">
                            <Link href={`/demandes/${r.id}`} className="text-brand-700 hover:underline">
                              {r.number}
                            </Link>
                            <RequestStatusBadge status={r.status} />
                          </span>
                        ))}
                      </span>
                    ) : wo.parentWorkOrderId ? (
                      <Link href={`/ordres-de-travail/${wo.parentWorkOrderId}`} className="text-brand-700 hover:underline">
                        Récidive d&apos;un OT précédent
                      </Link>
                    ) : null,
                  },
                ]}
              />
              {wo.description ? (
                <p className="mt-4 whitespace-pre-line border-t border-slate-100 pt-3 text-sm text-slate-700">{wo.description}</p>
              ) : null}
            </CardBody>
          </Card>
          {plannable ? (
            <PlanningCard
              wo={wo}
              technicians={techOptions}
              workshops={workshops.map((w) => ({ id: w.id, label: `${w.name} — ${w.siteName}` }))}
              suppliers={supplierOptions}
            />
          ) : null}
          <CostsCard wo={wo} canEdit={costEditable} suppliers={supplierOptions} />
          <HistoryCard wo={wo} />
        </div>
      </div>
    </>
  );
}
