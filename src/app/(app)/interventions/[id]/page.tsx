import { Printer } from "lucide-react";
import Link from "next/link";
import { ActionForm, SubmitButton } from "@/components/forms/action-form";
import { ApprovalCard } from "@/components/approvals/approval-card";
import { DocumentsCard } from "@/components/documents/documents-card";
import { PageHeader } from "@/components/layout/page-header";
import { buttonClass } from "@/components/ui/button";
import { CriticalityBadge, EquipmentStatusBadge, PriorityBadge, RequestStatusBadge, WorkOrderStatusBadge } from "@/components/status-badges";
import { Alert, Badge, Card, CardBody, CardHeader, DescriptionList } from "@/components/ui/primitives";
import { formatCurrency, formatDate, formatDateTime, formatMinutes, formatNumber } from "@/lib/format";
import { HOLD_REASON, PURCHASE_REQUEST_STATUS, WORK_ORDER_OUTCOME, WORK_ORDER_TYPE } from "@/lib/labels";
import { getAuthContext } from "@/server/auth/session";
import { OPEN_STATUSES } from "@/server/domain/work-order-status";
import { loadOr404 } from "@/server/pages";
import { listWarehouses, listWorkshops } from "@/server/services/organization";
import { listPartOptions, listSupplierOptions } from "@/server/services/stock";
import { getWorkOrder, listTechnicianOptions } from "@/server/services/work-orders";
import { recurrenceAction } from "../actions";
import { ChecklistCard, CostsCard, HistoryCard, PartsCard, PlanningCard, ReportCard, TimeCard, TransitionsCard } from "./sections";
import { T, Tr } from "@/i18n/client";
import { tpl } from "@/i18n/translate";

export const metadata = { title: "Intervention à réaliser" };

export default async function WorkOrderPage(props: PageProps<"/interventions/[id]">) {
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
        back={{ href: "/interventions", label: "Interventions à réaliser" }}
        title={
          <span className="flex flex-wrap items-baseline gap-3">
            <Tr>{wo.number}</Tr>
            <span className="text-lg font-normal text-slate-600">
              <Tr>{wo.title}</Tr>
            </span>
          </span>
        }
        meta={
          <>
            <WorkOrderStatusBadge status={wo.status} />
            {wo.validationStatus === "PENDING" && isOpen ? (
              <Badge tone="amber">
                <T>En attente de validation</T>
              </Badge>
            ) : null}
            {wo.validationStatus === "REJECTED" ? (
              <Badge tone="red">
                <T>Validation refusée</T>
              </Badge>
            ) : null}
            <PriorityBadge value={wo.priority} />
            <Badge>
              <Tr>{WORK_ORDER_TYPE[wo.type] ?? wo.type}</Tr>
            </Badge>
            {wo.isImmobilizing ? (
              <Badge tone="red">
                <T>Immobilisant</T>
              </Badge>
            ) : null}
            {wo.isSafetyRelated ? (
              <Badge tone="red">
                <T>Sécurité</T>
              </Badge>
            ) : null}
            {wo.isExternal ? (
              <Badge tone="violet">
                <T>Prestataire</T>
              </Badge>
            ) : null}
            {wo.reopenCount > 0 ? (
              <Badge tone="amber">
                <T params={{ reopenCount: wo.reopenCount }}>{"Rouvert {reopenCount} fois"}</T>
              </Badge>
            ) : null}
          </>
        }
        actions={
          <>
            <Link href={`/impression/intervention/${wo.id}`} className={buttonClass("secondary")}>
              <Printer className="h-4 w-4" aria-hidden />
              <T>Fiche à signer</T>
            </Link>
            {wo.canManage && (status === "TECH_CLOSED" || status === "CLOSED") ? (
              <ActionForm action={recurrenceAction.bind(null, wo.id)} showMessage>
                <SubmitButton variant="secondary">
                  <T>Créer une intervention de récidive</T>
                </SubmitButton>
              </ActionForm>
            ) : null}
          </>
        }
      />

      <div className="mb-6 space-y-3">
        {wo.validationStatus === "PENDING" && isOpen ? (
          <Alert tone="amber" title="Intervention en attente de validation">
            <T params={{ cost: wo.estimatedCost != null ? formatCurrency(wo.estimatedCost) : "" }}>
              {wo.estimatedCost != null
                ? "Elle ne peut être ni planifiée ni démarrée avant la décision du valideur (coût estimé : {cost})."
                : "Elle ne peut être ni planifiée ni démarrée avant la décision du valideur."}
            </T>
          </Alert>
        ) : null}
        {status === "ON_HOLD" ? (
          <Alert tone="amber" title={tpl`En attente${reasonOfHold ? ` : ${reasonOfHold}` : ""}`}>
            <Tr>{wo.holdComment ?? "Reprendre l'intervention dès que la cause de l'attente est levée."}</Tr>
          </Alert>
        ) : null}
        {wo.requiresRelease && isOpen ? (
          <Alert tone="blue" title="Remise en service à valider">
            <T>
              Équipement de criticité A ou intervention liée à la sécurité : la clôture technique est validée par une personne habilitée, différente
              de l&apos;exécutant.
            </T>
          </Alert>
        ) : null}
        {status === "CANCELLED" ? (
          <Alert tone="amber" title={tpl`Annulé le ${formatDate(wo.cancelledAt)}`}>
            <Tr>{wo.cancelReason}</Tr>
          </Alert>
        ) : null}
        {status === "TECH_CLOSED" || status === "CLOSED" ? (
          <Alert tone="green" title={tpl`Clôturé techniquement le ${formatDateTime(wo.techClosedAt)}`}>
            <T
              params={{
                outcome: wo.outcome ? WORK_ORDER_OUTCOME[wo.outcome] : "—",
                by: wo.releaseValidatedBy?.name ?? "",
                meter: wo.meterValueAtClose !== null ? formatNumber(wo.meterValueAtClose) : "",
              }}
            >
              {wo.releaseValidatedBy && wo.meterValueAtClose !== null
                ? "Résultat : {outcome} · remise en service validée par {by} · compteur à la clôture : {meter}"
                : wo.releaseValidatedBy
                  ? "Résultat : {outcome} · remise en service validée par {by}"
                  : wo.meterValueAtClose !== null
                    ? "Résultat : {outcome} · compteur à la clôture : {meter}"
                    : "Résultat : {outcome}"}
            </T>
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
          <ApprovalCard approvals={wo.validationApprovals} title="Validation de l'intervention" />
          <ApprovalCard approvals={wo.expenseApprovals} title="Validation des dépenses" />
          {wo.purchaseRequests.length > 0 || ctx.canOn("purchase.create", wo) ? (
            <Card>
              <CardHeader
                title="Demandes d'achat"
                description="Pièces et prestations demandées pour cette intervention"
                actions={
                  ctx.canOn("purchase.create", wo) && isOpen ? (
                    <Link href={`/demandes-achat/nouvelle?workOrderId=${wo.id}`} className="text-sm text-brand-700 hover:underline">
                      <T>Nouvelle demande d&apos;achat</T>
                    </Link>
                  ) : null
                }
              />
              {wo.purchaseRequests.length > 0 ? (
                <CardBody>
                  <ul className="space-y-1 text-sm">
                    {wo.purchaseRequests.map((p) => (
                      <li key={p.id} className="flex flex-wrap items-center gap-2">
                        <Link href={`/demandes-achat/${p.id}`} className="font-medium text-brand-700 hover:underline">
                          <Tr>{p.number}</Tr>
                        </Link>
                        <span className="text-slate-700">
                          <Tr>{p.description}</Tr>
                        </span>
                        <span className="tabular-nums text-slate-500">{formatCurrency(p.amount)}</span>
                        <Badge tone={PURCHASE_REQUEST_STATUS[p.status]?.tone}>
                          <Tr>{PURCHASE_REQUEST_STATUS[p.status]?.label}</Tr>
                        </Badge>
                      </li>
                    ))}
                  </ul>
                </CardBody>
              ) : null}
            </Card>
          ) : null}
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
                          <Tr>{wo.equipment.code}</Tr>
                        </Link>
                        <Tr>{wo.equipment.name}</Tr>
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
                              <Tr>{r.number}</Tr>
                            </Link>
                            <RequestStatusBadge status={r.status} />
                          </span>
                        ))}
                      </span>
                    ) : wo.parentWorkOrderId ? (
                      <Link href={`/interventions/${wo.parentWorkOrderId}`} className="text-brand-700 hover:underline">
                        <T>Récidive d&apos;une intervention précédente</T>
                      </Link>
                    ) : null,
                  },
                ]}
              />
              {wo.description ? (
                <p className="mt-4 whitespace-pre-line border-t border-slate-100 pt-3 text-sm text-slate-700">
                  <Tr>{wo.description}</Tr>
                </p>
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
