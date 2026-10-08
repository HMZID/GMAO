import { ActionForm, ActionPanel, Field, FormMessage, PanelForm, SubmitButton } from "@/components/forms/action-form";
import { ReadingStatusBadge, TaskResultBadge, WorkOrderStatusBadge } from "@/components/status-badges";
import { Button } from "@/components/ui/button";
import { Disclosure } from "@/components/ui/disclosure";
import { Checkbox, Input, Select, Textarea } from "@/components/ui/inputs";
import { Badge, Card, CardBody, CardHeader, EmptyState, Table, TBody, TD, TH, THead, TR } from "@/components/ui/primitives";
import { formatCurrency, formatDateTime, formatMinutes, formatNumber, toDateTimeInput } from "@/lib/format";
import {
  EXPENSE_APPROVAL,
  HOLD_REASON,
  MOVEMENT_TYPE,
  PRIORITY,
  RESERVATION_STATUS,
  TASK_KIND,
  TRANSITION_ACTION,
  WORK_ORDER_OUTCOME,
  WORK_ORDER_STATUS,
  options,
} from "@/lib/labels";
import type { getWorkOrder } from "@/server/services/work-orders";
import {
  addTaskAction,
  externalCostAction,
  otherCostAction,
  partAction,
  planningAction,
  releaseReservationsAction,
  reportAction,
  taskAction,
  timeAction,
  transitionAction,
  workOrderReadingAction,
} from "../actions";

export type WorkOrder = Awaited<ReturnType<typeof getWorkOrder>>;
type Opt = { id: string; label: string };

/* ------------------------------------------------------------------ */
/* Statut : transitions et conditions manquantes (COR-06, DON-11)       */
/* ------------------------------------------------------------------ */

export function TransitionsCard({ wo }: { wo: WorkOrder }) {
  if (wo.transitions.length === 0) return null;
  const fromDone = wo.status === "WORK_DONE" || wo.status === "TECH_CLOSED";
  return (
    <Card>
      <CardHeader title="Faire avancer l'OT" description="Les conditions manquantes sont toutes listées sous chaque action." />
      <CardBody>
        <ActionPanel action={transitionAction.bind(null, wo.id)} className="grid gap-4 md:grid-cols-2 [&>[role]]:md:col-span-2">
          {wo.transitions.map((t) => {
            const label =
              t.to === "IN_PROGRESS" && fromDone
                ? wo.status === "TECH_CLOSED"
                  ? "Rouvrir l'OT"
                  : "Reprendre (essai non concluant)"
                : TRANSITION_ACTION[t.to];
            const variant = t.to === "CANCELLED" ? "danger" : t.to === "ON_HOLD" ? "secondary" : "primary";
            if (!t.allowed) {
              return (
                <div key={t.to} className="rounded-md border border-slate-200 p-3">
                  <Button disabled variant="secondary" size="sm">
                    {label}
                  </Button>
                  <ul className="mt-2 list-disc space-y-0.5 pl-5 text-xs text-slate-600">
                    {t.errors.map((e) => (
                      <li key={e}>{e}</li>
                    ))}
                  </ul>
                </div>
              );
            }
            return (
              <PanelForm key={t.to} className="space-y-3 rounded-md border border-slate-200 p-3">
                <input type="hidden" name="to" value={t.to} />
                {t.to === "ON_HOLD" ? (
                  <>
                    <Field label="Motif d'attente" name="holdReason" required>
                      <Select id={`hold-${t.to}`} name="holdReason" required placeholder="Choisir…" options={options(HOLD_REASON)} />
                    </Field>
                    <Field label="Précision" name="reason">
                      <Input id="hold-comment" name="reason" maxLength={1000} placeholder="Ex. pompe commandée, livraison J+3" />
                    </Field>
                  </>
                ) : null}
                {t.to === "CANCELLED" || (t.to === "IN_PROGRESS" && fromDone) ? (
                  <Field label="Motif" name="reason" required>
                    <Textarea id={`reason-${t.to}`} name="reason" rows={2} required maxLength={1000} />
                  </Field>
                ) : null}
                {t.to === "WORK_DONE" || t.to === "TECH_CLOSED" ? (
                  <Field label="Résultat" name="outcome">
                    <Select id={`outcome-${t.to}`} name="outcome" defaultValue={wo.outcome ?? "RESOLVED"} options={options(WORK_ORDER_OUTCOME)} />
                  </Field>
                ) : null}
                {t.to === "TECH_CLOSED" ? <Checkbox name="testsPassed" required label="Essais de remise en service conformes" /> : null}
                {t.to === "TECH_CLOSED" && wo.requiresRelease ? (
                  <p className="text-xs text-amber-800">
                    Équipement critique ou intervention de sécurité : validation par une personne habilitée, différente de l&apos;exécutant (COR-12).
                  </p>
                ) : null}
                <SubmitButton variant={variant} size="sm">
                  {label}
                </SubmitButton>
              </PanelForm>
            );
          })}
        </ActionPanel>
      </CardBody>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Planification (PLA-01, PLA-07)                                        */
/* ------------------------------------------------------------------ */

export function PlanningCard({
  wo,
  technicians,
  workshops,
  suppliers,
}: {
  wo: WorkOrder;
  technicians: (Opt & { siteId: string })[];
  workshops: Opt[];
  suppliers: Opt[];
}) {
  const assigned = new Set(wo.assignees.map((a) => a.technician.id));
  const sorted = [...technicians].sort((a, b) => Number(b.siteId === wo.siteId) - Number(a.siteId === wo.siteId));
  return (
    <Card>
      <CardHeader title="Planification" description="Absence = blocage ; chevauchement = avertissement" />
      <CardBody>
        <ActionForm action={planningAction.bind(null, wo.id)} className="space-y-3">
          <input type="hidden" name="assigneesField" value="1" />
          <input type="hidden" name="externalField" value="1" />
          <Field label="Début prévu" name="plannedStart">
            <Input id="plannedStart" name="plannedStart" type="datetime-local" defaultValue={toDateTimeInput(wo.plannedStart)} />
          </Field>
          <Field label="Durée estimée (minutes)" name="estimatedMinutes">
            <Input id="estimatedMinutes" name="estimatedMinutes" type="number" min={1} defaultValue={wo.estimatedMinutes ?? ""} />
          </Field>
          <Field label="Priorité" name="priority">
            <Select id="priority" name="priority" defaultValue={wo.priority} options={options(PRIORITY)} />
          </Field>
          <Field label="Atelier" name="workshopId">
            <Select
              id="workshopId"
              name="workshopId"
              defaultValue={wo.workshopId ?? ""}
              placeholder="—"
              options={workshops.map((w) => ({ value: w.id, label: w.label }))}
            />
          </Field>
          <fieldset>
            <legend className="mb-1 text-sm font-medium text-slate-700">Intervenants</legend>
            <div className="grid gap-1.5">
              {sorted.map((t) => (
                <Checkbox key={t.id} name="assigneeIds[]" value={t.id} label={t.label} defaultChecked={assigned.has(t.id)} />
              ))}
            </div>
          </fieldset>
          <Checkbox name="isExternal" label="Réalisé par un prestataire" defaultChecked={wo.isExternal} />
          <Field label="Prestataire" name="supplierId">
            <Select
              id="plan-supplierId"
              name="supplierId"
              defaultValue={wo.supplierId ?? ""}
              placeholder="—"
              options={suppliers.map((s) => ({ value: s.id, label: s.label }))}
            />
          </Field>
          <SubmitButton variant="secondary">Enregistrer la planification</SubmitButton>
        </ActionForm>
      </CardBody>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Checklist (PRV-11)                                                    */
/* ------------------------------------------------------------------ */

export function ChecklistCard({ wo, canFill, canAdd }: { wo: WorkOrder; canFill: boolean; canAdd: boolean }) {
  return (
    <Card>
      <CardHeader title="Checklist" description="Points de la gamme ; les points obligatoires conditionnent la fin des travaux" />
      {wo.tasks.length === 0 ? (
        <EmptyState title="Aucun point de contrôle" />
      ) : (
        <ul className="divide-y divide-slate-100">
          {wo.tasks.map((task) => (
            <li key={task.id} className="px-5 py-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm text-slate-900">
                    {task.position}. {task.label}{" "}
                    {task.required ? (
                      <span className="text-red-600" title="Obligatoire">
                        *
                      </span>
                    ) : null}
                  </p>
                  <p className="text-xs text-slate-500">
                    {TASK_KIND[task.kind]}
                    {task.kind === "MEASURE" && (task.minValue !== null || task.maxValue !== null)
                      ? ` · attendu ${task.minValue ?? "−∞"} à ${task.maxValue ?? "+∞"} ${task.unit ?? ""}`
                      : ""}
                    {task.measuredValue !== null ? ` · mesuré ${formatNumber(task.measuredValue, task.unit ?? undefined)}` : ""}
                    {task.comment ? ` · ${task.comment}` : ""}
                  </p>
                </div>
                <TaskResultBadge result={task.result} />
              </div>
              {canFill ? (
                <ActionForm action={taskAction.bind(null, wo.id, task.id)} className="mt-2 flex flex-wrap items-end gap-2" showMessage={false}>
                  {task.kind === "MEASURE" ? (
                    <Input
                      name="measuredValue"
                      type="number"
                      step="any"
                      placeholder={`Mesure${task.unit ? ` (${task.unit})` : ""}`}
                      className="h-8 w-36"
                      defaultValue={task.measuredValue ?? ""}
                      aria-label="Valeur mesurée"
                    />
                  ) : null}
                  <Input
                    name="comment"
                    placeholder="Commentaire"
                    className="h-8 min-w-40 flex-1"
                    defaultValue={task.comment ?? ""}
                    aria-label="Commentaire"
                  />
                  <SubmitButton size="sm" variant="secondary" name="result" value="OK">
                    Conforme
                  </SubmitButton>
                  <SubmitButton size="sm" variant="secondary" name="result" value="NOK">
                    Non conforme
                  </SubmitButton>
                  <SubmitButton size="sm" variant="ghost" name="result" value="NA">
                    Sans objet
                  </SubmitButton>
                  <FormMessage className="mb-0 w-full" />
                </ActionForm>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      {canAdd ? (
        <CardBody className="border-t border-slate-100">
          <ActionForm action={addTaskAction.bind(null, wo.id)} resetOnSuccess className="flex flex-wrap items-end gap-3">
            <Field label="Ajouter un point" name="label" className="min-w-64 flex-1">
              <Input id="task-label" name="label" required maxLength={300} />
            </Field>
            <Checkbox name="required" label="Obligatoire" className="h-10" />
            <SubmitButton variant="secondary">Ajouter</SubmitButton>
          </ActionForm>
        </CardBody>
      ) : null}
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Temps passés (COR-09)                                                 */
/* ------------------------------------------------------------------ */

export function TimeCard({
  wo,
  myTechnicianId,
  canTimer,
  canManual,
  technicians,
}: {
  wo: WorkOrder;
  myTechnicianId: string | null;
  canTimer: boolean;
  canManual: boolean;
  technicians: Opt[];
}) {
  const running = myTechnicianId ? wo.timeEntries.find((t) => !t.endedAt && t.technicianId === myTechnicianId) : undefined;
  return (
    <Card>
      <CardHeader title="Temps passés" description={`Total : ${formatMinutes(wo.costs.minutes)} — ${formatCurrency(wo.costs.labor)}`} />
      {canTimer && myTechnicianId ? (
        <CardBody className="border-b border-slate-100">
          <ActionForm action={timeAction.bind(null, wo.id)} className="flex flex-wrap items-center gap-3">
            {running ? (
              <>
                <Badge tone="violet">Pointage en cours depuis {formatDateTime(running.startedAt)}</Badge>
                <SubmitButton name="action" value="stop" variant="secondary" size="sm">
                  Arrêter le pointage
                </SubmitButton>
              </>
            ) : (
              <SubmitButton name="action" value="start" size="sm">
                Démarrer le pointage
              </SubmitButton>
            )}
          </ActionForm>
        </CardBody>
      ) : null}
      {wo.timeEntries.length === 0 ? (
        <EmptyState title="Aucun temps saisi" />
      ) : (
        <Table>
          <THead>
            <tr>
              <TH>Technicien</TH>
              <TH>Début</TH>
              <TH className="text-right">Durée</TH>
              <TH>Commentaire</TH>
            </tr>
          </THead>
          <TBody>
            {wo.timeEntries.map((t) => (
              <TR key={t.id}>
                <TD>
                  {t.technician.firstName} {t.technician.lastName}
                </TD>
                <TD className="whitespace-nowrap">{formatDateTime(t.startedAt)}</TD>
                <TD className="text-right tabular-nums">{t.endedAt ? formatMinutes(t.minutes) : <Badge tone="violet">en cours</Badge>}</TD>
                <TD className="text-xs text-slate-500">{t.comment}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}
      {canManual ? (
        <CardBody className="border-t border-slate-100">
          <Disclosure summary="Saisir une durée">
            <ActionForm action={timeAction.bind(null, wo.id)} resetOnSuccess className="grid gap-3 sm:grid-cols-2">
              <input type="hidden" name="action" value="manual" />
              {technicians.length > 0 ? (
                <Field label="Technicien" name="technicianId" className="sm:col-span-2">
                  <Select
                    id="time-tech"
                    name="technicianId"
                    defaultValue={myTechnicianId ?? ""}
                    placeholder={myTechnicianId ? undefined : "Choisir…"}
                    options={technicians.map((t) => ({ value: t.id, label: t.label }))}
                  />
                </Field>
              ) : null}
              <Field label="Durée (minutes)" name="minutes" required>
                <Input id="time-minutes" name="minutes" type="number" min={1} max={1440} required />
              </Field>
              <Field label="Début" name="startedAt">
                <Input id="time-start" name="startedAt" type="datetime-local" />
              </Field>
              <Field label="Commentaire" name="comment" className="sm:col-span-2">
                <Input id="time-comment" name="comment" maxLength={500} />
              </Field>
              <div>
                <SubmitButton variant="secondary">Enregistrer</SubmitButton>
              </div>
            </ActionForm>
          </Disclosure>
        </CardBody>
      ) : null}
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Relevé compteur et compte rendu (COR-04, COR-11)                      */
/* ------------------------------------------------------------------ */

export function ReportCard({ wo, canReport, canRead }: { wo: WorkOrder; canReport: boolean; canRead: boolean }) {
  const meter = wo.meters[0];
  return (
    <Card>
      <CardHeader title="Compte rendu" description="Travaux réalisés, codification des défauts et relevé du compteur" />
      <CardBody className="space-y-5">
        {meter ? (
          <div className="rounded-md bg-slate-50 p-3 text-sm">
            <p className="text-slate-700">
              {meter.label} : <span className="font-semibold tabular-nums">{formatNumber(meter.lastValue, meter.unit)}</span>
              <span className="text-xs text-slate-500"> (relevé du {formatDateTime(meter.lastReadAt)})</span>
            </p>
            {wo.snapshot.hasMeterReadingSinceStart ? (
              <p className="mt-1 flex items-center gap-1 text-xs text-emerald-700">
                <ReadingStatusBadge status="VALID" /> Relevé saisi pendant l&apos;intervention
              </p>
            ) : null}
            {canRead ? (
              <ActionForm action={workOrderReadingAction.bind(null, wo.id, meter.id)} resetOnSuccess className="mt-3 flex flex-wrap items-end gap-2">
                <Field label={`Relevé (${meter.unit})`} name="value" required className="w-40">
                  <Input id="wo-reading" name="value" type="number" min={0} step="0.1" required />
                </Field>
                <SubmitButton variant="secondary">Enregistrer le relevé</SubmitButton>
              </ActionForm>
            ) : null}
          </div>
        ) : null}
        {canReport ? (
          <ActionForm action={reportAction.bind(null, wo.id)} className="space-y-3">
            <Field label="Travaux réalisés" name="workSummary">
              <Textarea id="workSummary" name="workSummary" rows={4} defaultValue={wo.workSummary ?? ""} maxLength={4000} />
            </Field>
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Symptôme (code)" name="symptomCode">
                <Input id="symptomCode" name="symptomCode" defaultValue={wo.symptomCode ?? ""} maxLength={40} />
              </Field>
              <Field label="Cause" name="causeCode">
                <Input id="causeCode" name="causeCode" defaultValue={wo.causeCode ?? ""} maxLength={40} />
              </Field>
              <Field label="Remède" name="remedyCode">
                <Input id="remedyCode" name="remedyCode" defaultValue={wo.remedyCode ?? ""} maxLength={40} />
              </Field>
            </div>
            <SubmitButton variant="secondary">Enregistrer le compte rendu</SubmitButton>
          </ActionForm>
        ) : (
          <div className="space-y-2 text-sm">
            <p className="whitespace-pre-line text-slate-800">
              {wo.workSummary || <span className="text-slate-400">Pas encore de compte rendu.</span>}
            </p>
            {wo.symptomCode || wo.causeCode || wo.remedyCode ? (
              <p className="text-xs text-slate-500">
                Symptôme : {wo.symptomCode ?? "—"} · Cause : {wo.causeCode ?? "—"} · Remède : {wo.remedyCode ?? "—"}
              </p>
            ) : null}
          </div>
        )}
      </CardBody>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Pièces (COR-10, STK-05)                                               */
/* ------------------------------------------------------------------ */

export function PartsCard({
  wo,
  canReserve,
  canIssue,
  parts,
  warehouses,
}: {
  wo: WorkOrder;
  canReserve: boolean;
  canIssue: boolean;
  parts: Opt[];
  warehouses: Opt[];
}) {
  const active = wo.reservations.filter((r) => r.status === "ACTIVE");
  const actions = [
    ...(canReserve ? [{ value: "reserve", label: "Réserver" }] : []),
    ...(canIssue
      ? [
          { value: "issue", label: "Sortir du stock (consommer)" },
          { value: "return", label: "Retourner en stock" },
        ]
      : []),
  ];
  return (
    <Card>
      <CardHeader title="Pièces" description={`Coût des pièces consommées : ${formatCurrency(wo.costs.parts)}`} />
      {wo.reservations.length > 0 ? (
        <Table>
          <THead>
            <tr>
              <TH>Réservation</TH>
              <TH>Magasin</TH>
              <TH className="text-right">Quantité</TH>
              <TH>Statut</TH>
            </tr>
          </THead>
          <TBody>
            {wo.reservations.map((r) => (
              <TR key={r.id}>
                <TD>
                  {r.sku} — {r.partName}
                </TD>
                <TD>{r.warehouseName}</TD>
                <TD className="text-right tabular-nums">
                  {formatNumber(r.consumedQuantity)} / {formatNumber(r.quantity)}
                </TD>
                <TD>
                  <Badge tone={RESERVATION_STATUS[r.status]?.tone}>{RESERVATION_STATUS[r.status]?.label ?? r.status}</Badge>
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      ) : null}
      {wo.partLines.length > 0 ? (
        <Table className="border-t border-slate-100">
          <THead>
            <tr>
              <TH>Mouvement</TH>
              <TH>Article</TH>
              <TH>Magasin</TH>
              <TH className="text-right">Quantité</TH>
              <TH className="text-right">Valeur</TH>
            </tr>
          </THead>
          <TBody>
            {wo.partLines.map((l) => (
              <TR key={l.id}>
                <TD className="whitespace-nowrap">
                  {MOVEMENT_TYPE[l.type]?.label ?? l.type}
                  <p className="text-xs text-slate-400">{formatDateTime(l.createdAt)}</p>
                </TD>
                <TD>
                  {l.sku} — {l.partName}
                </TD>
                <TD>{l.warehouseName}</TD>
                <TD className="text-right tabular-nums">{formatNumber(l.quantity, l.unit)}</TD>
                <TD className="text-right tabular-nums">{formatCurrency(l.quantity * l.unitCost * (l.type === "RETURN" ? -1 : 1))}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
      ) : null}
      {wo.reservations.length === 0 && wo.partLines.length === 0 ? <EmptyState title="Aucune pièce" /> : null}
      {actions.length > 0 ? (
        <CardBody className="space-y-3 border-t border-slate-100">
          <ActionForm action={partAction.bind(null, wo.id)} className="grid gap-3 sm:grid-cols-2">
            <Field label="Opération" name="action" required>
              <Select id="part-action" name="action" options={actions} />
            </Field>
            <Field label="Magasin" name="warehouseId" required>
              <Select
                id="part-warehouse"
                name="warehouseId"
                required
                placeholder="Choisir…"
                options={warehouses.map((w) => ({ value: w.id, label: w.label }))}
              />
            </Field>
            <Field label="Article" name="partId" required className="sm:col-span-2">
              <Select id="part-id" name="partId" required placeholder="Choisir…" options={parts.map((p) => ({ value: p.id, label: p.label }))} />
            </Field>
            <Field label="Quantité" name="quantity" required>
              <Input id="part-qty" name="quantity" type="number" min={0} step="any" required />
            </Field>
            <div className="flex items-end">
              <SubmitButton variant="secondary">Valider</SubmitButton>
            </div>
          </ActionForm>
          {active.length > 0 && canIssue ? (
            <ActionForm action={releaseReservationsAction.bind(null, wo.id)}>
              <SubmitButton variant="ghost" size="sm">
                Libérer les réservations non consommées
              </SubmitButton>
            </ActionForm>
          ) : null}
        </CardBody>
      ) : null}
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Coûts (KPI-01, COR-15, ACH-10)                                        */
/* ------------------------------------------------------------------ */

export function CostsCard({ wo, canEdit, suppliers }: { wo: WorkOrder; canEdit: boolean; suppliers: Opt[] }) {
  const c = wo.costs;
  return (
    <Card>
      <CardHeader title="Coûts" description="Main-d'œuvre au taux horaire en vigueur, pièces au coût moyen pondéré" />
      <CardBody className="space-y-4">
        <dl className="space-y-1 text-sm">
          {[
            ["Main-d'œuvre", c.labor],
            ["Pièces", c.parts],
            [`Prestataire${wo.isExternal ? (wo.externalCostIsFinal ? " (facturé)" : " (provision)") : ""}`, c.external],
            ["Autres", c.other],
          ].map(([label, value]) => (
            <div key={label as string} className="flex justify-between">
              <dt className="text-slate-500">{label}</dt>
              <dd className="tabular-nums">{formatCurrency(value as number)}</dd>
            </div>
          ))}
          <div className="flex justify-between border-t border-slate-200 pt-1 font-semibold">
            <dt>Total</dt>
            <dd className="tabular-nums">{formatCurrency(c.total)}</dd>
          </div>
        </dl>
        {wo.costRows.length > 0 ? (
          <ul className="text-xs text-slate-500">
            {wo.costRows.map((x) => (
              <li key={x.id} className="flex flex-wrap items-center gap-1.5">
                {x.label} : {formatCurrency(x.amount)}
                {x.approvalStatus !== "APPROVED" ? (
                  <Badge tone={EXPENSE_APPROVAL[x.approvalStatus]?.tone}>{EXPENSE_APPROVAL[x.approvalStatus]?.label}</Badge>
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}
        {canEdit ? (
          <>
            <Disclosure summary="Coût prestataire">
              <ActionForm action={externalCostAction.bind(null, wo.id)} className="space-y-3">
                <Field label="Prestataire" name="supplierId">
                  <Select
                    id="ext-supplier"
                    name="supplierId"
                    defaultValue={wo.supplierId ?? ""}
                    placeholder="—"
                    options={suppliers.map((s) => ({ value: s.id, label: s.label }))}
                  />
                </Field>
                <Field label="Montant HT (€)" name="externalCost" required>
                  <Input id="ext-amount" name="externalCost" type="number" min={0} step="0.01" required defaultValue={wo.externalCost ?? ""} />
                </Field>
                <Checkbox name="externalCostIsFinal" label="Montant facturé (sinon provision)" defaultChecked={wo.externalCostIsFinal} />
                <SubmitButton variant="secondary">Enregistrer</SubmitButton>
              </ActionForm>
            </Disclosure>
            <Disclosure summary="Autre coût (location, transport…)">
              <ActionForm action={otherCostAction.bind(null, wo.id)} resetOnSuccess className="space-y-3">
                <Field label="Libellé" name="label" required>
                  <Input id="other-label" name="label" required maxLength={200} />
                </Field>
                <Field label="Montant HT (€)" name="amount" required>
                  <Input id="other-amount" name="amount" type="number" min={0} step="0.01" required />
                </Field>
                <SubmitButton variant="secondary">Ajouter</SubmitButton>
              </ActionForm>
            </Disclosure>
          </>
        ) : null}
      </CardBody>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Historique des statuts (DON-10)                                       */
/* ------------------------------------------------------------------ */

export function HistoryCard({ wo }: { wo: WorkOrder }) {
  return (
    <Card>
      <CardHeader title="Historique" />
      <ul className="divide-y divide-slate-100 text-sm">
        {wo.statusHistory.map((h) => (
          <li key={h.id} className="px-5 py-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5">
                {h.fromStatus ? <span className="text-xs text-slate-500">{WORK_ORDER_STATUS[h.fromStatus]?.label} →</span> : null}
                <WorkOrderStatusBadge status={h.toStatus} />
              </span>
              <span className="text-xs text-slate-500">{formatDateTime(h.changedAt)}</span>
            </div>
            {h.reason ? <p className="mt-1 text-xs text-slate-600">{HOLD_REASON[h.reason] ?? h.reason}</p> : null}
            {h.changedBy ? <p className="text-xs text-slate-400">{h.changedBy.name}</p> : null}
          </li>
        ))}
      </ul>
    </Card>
  );
}
