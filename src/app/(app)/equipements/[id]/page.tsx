import { AlertTriangle, QrCode } from "lucide-react";
import Link from "next/link";
import { ActionForm, Field, SubmitButton } from "@/components/forms/action-form";
import { DocumentsCard } from "@/components/documents/documents-card";
import { PageHeader } from "@/components/layout/page-header";
import {
  CriticalityBadge,
  DueStatusBadge,
  EquipmentStatusBadge,
  PriorityBadge,
  ReadingStatusBadge,
  RequestStatusBadge,
  WorkOrderStatusBadge,
} from "@/components/status-badges";
import { ButtonLink } from "@/components/ui/button";
import { Disclosure } from "@/components/ui/disclosure";
import { Input, Select, Textarea } from "@/components/ui/inputs";
import { Alert, Badge, Card, CardBody, CardHeader, DescriptionList, EmptyState, Table, TBody, TD, TH, THead, TR } from "@/components/ui/primitives";
import { formatCurrency, formatDate, formatDateTime, formatNumber, toDateTimeInput } from "@/lib/format";
import { ACQUISITION_MODE, EQUIPMENT_STATUS, METER_TYPE, READING_SOURCE, WORK_ORDER_TYPE } from "@/lib/labels";
import { getAuthContext } from "@/server/auth/session";
import type { AuthContext } from "@/server/authz/context";
import { loadOr404 } from "@/server/pages";
import { getEquipment, listJobsitesAndWorkshopsForAssignment } from "@/server/services/equipment";
import { listReadings } from "@/server/services/meters";
import { listSites } from "@/server/services/organization";
import {
  applyPlanAction,
  assignEquipmentAction,
  endAssignmentAction,
  recordReadingAction,
  replaceMeterAction,
  retireEquipmentAction,
  reviewReadingAction,
} from "../actions";

export const metadata = { title: "Fiche équipement" };

type Equipment = Awaited<ReturnType<typeof getEquipment>>;

export default async function EquipmentPage(props: PageProps<"/equipements/[id]">) {
  const { id } = await props.params;
  const ctx = await getAuthContext();
  const e = await loadOr404(id, (x) => getEquipment(ctx, x));
  const readings = await Promise.all(e.meters.map((m) => listReadings(ctx, m.id, 12)));
  const retired = e.status === "RETIRED";
  const lastStatusChange = e.statusHistory[0];
  const attributes = Object.entries(e.attributes ?? {}).map(([key, value]) => {
    const def = e.category.attributeDefinitions?.find((d) => d.key === key);
    return { label: def?.label ?? key, value: value === null ? "—" : `${value}${def?.unit ? ` ${def.unit}` : ""}` };
  });

  return (
    <>
      <PageHeader
        back={{ href: "/equipements", label: "Équipements" }}
        title={
          <span className="flex flex-wrap items-center gap-3">
            {e.code}
            <span className="text-lg font-normal text-slate-500">{e.name}</span>
          </span>
        }
        meta={
          <>
            <EquipmentStatusBadge status={e.status} />
            <CriticalityBadge value={e.criticality} />
            <Badge>{e.category.name}</Badge>
            <span className="text-sm text-slate-500">
              {e.site.name} · {e.company.name}
            </span>
          </>
        }
        actions={
          retired ? null : (
            <>
              {ctx.canOn("request.create", e) ? <ButtonLink href={`/demandes/nouvelle?equipmentId=${e.id}`}>Signaler une panne</ButtonLink> : null}
              {ctx.canOn("workorder.create", e) ? (
                <ButtonLink href={`/ordres-de-travail/nouveau?equipmentId=${e.id}`} variant="secondary">
                  Nouvel OT
                </ButtonLink>
              ) : null}
              {ctx.canOn("equipment.write", e) ? (
                <ButtonLink href={`/equipements/${e.id}/modifier`} variant="ghost">
                  Modifier
                </ButtonLink>
              ) : null}
            </>
          )
        }
      />

      {e.status === "IMMOBILIZED" ? (
        <div className="mb-6">
          <Alert tone="red" title="Équipement immobilisé : inapte à l'exploitation">
            {lastStatusChange?.reason ?? "Voir les interventions en cours."}
          </Alert>
        </div>
      ) : null}
      {retired ? (
        <div className="mb-6">
          <Alert tone="amber" title={`Réformé le ${formatDate(e.retiredAt)}`}>
            {e.retirementReason} — fiche en lecture seule, historique conservé (EQP-14).
          </Alert>
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <MetersCard e={e} readings={readings} ctx={ctx} retired={retired} />
          <DueItemsCard e={e} ctx={ctx} retired={retired} />
          <InterventionsCard e={e} />
          <DocumentsCard ctx={ctx} entityType="EQUIPMENT" entityId={e.id} now={new Date()} />
        </div>
        <div className="space-y-6">
          <Card>
            <CardHeader title="Identification" />
            <CardBody>
              <DescriptionList
                columns={1}
                items={[
                  { label: "Marque et modèle", value: [e.manufacturer, e.model?.name].filter(Boolean).join(" ") },
                  { label: "Numéro de série", value: e.serialNumber },
                  { label: "Immatriculation", value: e.registration },
                  { label: "Année", value: e.year },
                  {
                    label: "Acquisition",
                    value: `${ACQUISITION_MODE[e.acquisitionMode] ?? e.acquisitionMode}${e.acquisitionDate ? ` le ${formatDate(e.acquisitionDate)}` : ""}`,
                  },
                  { label: "Valeur d'acquisition", value: e.acquisitionValue ? formatCurrency(e.acquisitionValue) : null },
                  { label: "Mise en service", value: formatDate(e.commissioningDate) },
                  {
                    label: "Garantie",
                    value:
                      e.warrantyEndDate || e.warrantyEndMeter
                        ? [
                            e.warrantyEndDate ? `jusqu'au ${formatDate(e.warrantyEndDate)}` : null,
                            e.warrantyEndMeter ? `ou ${formatNumber(e.warrantyEndMeter)}` : null,
                          ]
                            .filter(Boolean)
                            .join(" ")
                        : null,
                  },
                  ...attributes,
                  { label: "Notes", value: e.notes },
                ]}
              />
              <p className="mt-4 flex items-center gap-2 text-xs text-slate-500">
                <QrCode className="h-4 w-4" aria-hidden />
                Étiquette QR : <code className="rounded bg-slate-100 px-1.5 py-0.5">{e.qrToken}</code>
              </p>
            </CardBody>
          </Card>
          <AssignmentCard e={e} ctx={ctx} retired={retired} />
          <Card>
            <CardHeader title="Historique des états" description="10 derniers changements (EQP-05)" />
            {e.statusHistory.length === 0 ? (
              <EmptyState title="Aucun changement" />
            ) : (
              <ul className="divide-y divide-slate-100 text-sm">
                {e.statusHistory.map((h) => (
                  <li key={h.id} className="px-5 py-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-1.5">
                        {h.fromStatus ? <span className="text-slate-500">{EQUIPMENT_STATUS[h.fromStatus]?.label} →</span> : null}
                        <EquipmentStatusBadge status={h.toStatus} />
                      </span>
                      <span className="text-xs text-slate-500">{formatDateTime(h.changedAt)}</span>
                    </div>
                    {h.reason ? <p className="mt-1 text-xs text-slate-600">{h.reason}</p> : null}
                    {h.changedBy ? <p className="text-xs text-slate-400">{h.changedBy.name}</p> : null}
                  </li>
                ))}
              </ul>
            )}
          </Card>
          {!retired && ctx.canOn("equipment.write", e) ? (
            <Disclosure summary={<span className="text-red-700">Réformer l&apos;équipement</span>}>
              <ActionForm action={retireEquipmentAction.bind(null, e.id)} className="space-y-3">
                <p className="text-sm text-slate-600">
                  Impossible tant qu&apos;un OT est ouvert. Les plans sont désactivés et la fiche passe en lecture seule.
                </p>
                <Field label="Motif" name="reason" required>
                  <Textarea id="reason" name="reason" required rows={2} />
                </Field>
                <Field label="Valeur de cession (€)" name="disposalValue">
                  <Input id="disposalValue" name="disposalValue" type="number" min={0} step="0.01" />
                </Field>
                <SubmitButton variant="danger">Réformer</SubmitButton>
              </ActionForm>
            </Disclosure>
          ) : null}
        </div>
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Compteurs et relevés (EQP-04, DON-01 à DON-04)                        */
/* ------------------------------------------------------------------ */

function MetersCard({
  e,
  readings,
  ctx,
  retired,
}: {
  e: Equipment;
  readings: Awaited<ReturnType<typeof listReadings>>[];
  ctx: AuthContext;
  retired: boolean;
}) {
  const canWrite = !retired && ctx.canOn("meter.write", e);
  const canCorrect = !retired && ctx.canOn("meter.correct", e);
  return (
    <Card>
      <CardHeader title="Compteurs" description="Valeur lue sur le compteur et valeur cumulée (conservée après un remplacement)" />
      {e.meters.length === 0 ? (
        <EmptyState title="Aucun compteur" description="Préventif calendaire uniquement." />
      ) : (
        <div className="divide-y divide-slate-100">
          {e.meters.map((m, i) => (
            <div key={m.id} className="space-y-4 px-5 py-4">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-slate-900">
                    {m.label} {m.isPrimary ? <Badge tone="teal">Principal</Badge> : null}
                  </p>
                  <p className="text-xs text-slate-500">{METER_TYPE[m.type]}</p>
                </div>
                <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-4">
                  <div>
                    <dt className="text-xs text-slate-500">Valeur lue</dt>
                    <dd className="font-semibold tabular-nums">{formatNumber(m.lastValue, m.unit)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-500">Cumulée</dt>
                    <dd className="tabular-nums">{formatNumber(m.lastCumulativeValue, m.unit)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-500">Usage moyen</dt>
                    <dd className="tabular-nums">{m.averageDailyUsage ? `${formatNumber(m.averageDailyUsage, m.unit)}/j` : "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-500">Dernier relevé</dt>
                    <dd>{formatDateTime(m.lastReadAt)}</dd>
                  </div>
                </dl>
              </div>

              {canWrite ? (
                <ActionForm action={recordReadingAction.bind(null, m.id)} resetOnSuccess className="rounded-md bg-slate-50 p-3">
                  <div className="flex flex-wrap items-end gap-3">
                    <Field label={`Nouveau relevé (${m.unit})`} name="value" required className="w-40">
                      <Input id={`value-${m.id}`} name="value" type="number" min={0} step="0.1" required />
                    </Field>
                    <Field label="Date et heure" name="readAt" className="w-52">
                      <Input id={`readAt-${m.id}`} name="readAt" type="datetime-local" defaultValue={toDateTimeInput(new Date())} />
                    </Field>
                    <Field label="Commentaire" name="comment" className="min-w-48 flex-1">
                      <Input id={`comment-${m.id}`} name="comment" maxLength={500} />
                    </Field>
                    <SubmitButton size="md">Enregistrer</SubmitButton>
                  </div>
                </ActionForm>
              ) : null}

              {canCorrect ? (
                <Disclosure summary="Remplacement du compteur (DON-04)">
                  <ActionForm action={replaceMeterAction.bind(null, m.id)} className="grid gap-3 sm:grid-cols-2">
                    <Field label="Dernière valeur de l'ancien compteur" name="oldFinalValue" required>
                      <Input id={`old-${m.id}`} name="oldFinalValue" type="number" min={0} step="0.1" required defaultValue={m.lastValue ?? ""} />
                    </Field>
                    <Field label="Valeur initiale du nouveau compteur" name="newInitialValue" required>
                      <Input id={`new-${m.id}`} name="newInitialValue" type="number" min={0} step="0.1" required defaultValue={0} />
                    </Field>
                    <Field label="Date du remplacement" name="occurredAt">
                      <Input id={`occ-${m.id}`} name="occurredAt" type="datetime-local" defaultValue={toDateTimeInput(new Date())} />
                    </Field>
                    <Field label="Motif" name="reason" required>
                      <Input id={`reason-${m.id}`} name="reason" required maxLength={500} />
                    </Field>
                    <div className="sm:col-span-2">
                      <SubmitButton variant="secondary">Enregistrer le remplacement</SubmitButton>
                    </div>
                  </ActionForm>
                </Disclosure>
              ) : null}

              <ReadingsTable readings={readings[i] ?? []} unit={m.unit} canReview={canCorrect} />
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function ReadingsTable({ readings, unit, canReview }: { readings: Awaited<ReturnType<typeof listReadings>>; unit: string; canReview: boolean }) {
  if (readings.length === 0) return <p className="text-sm text-slate-500">Aucun relevé.</p>;
  return (
    <Table className="rounded-md border border-slate-100">
      <THead>
        <tr>
          <TH>Date</TH>
          <TH className="text-right">Relevé</TH>
          <TH>Source</TH>
          <TH>Statut</TH>
          <TH className="w-full">Commentaire</TH>
        </tr>
      </THead>
      <TBody>
        {readings.map((r) => (
          <TR key={r.id}>
            <TD className="whitespace-nowrap">{formatDateTime(r.readAt)}</TD>
            <TD className="whitespace-nowrap text-right tabular-nums">
              {formatNumber(r.value, unit)}
              {r.cumulativeValue !== r.value ? <p className="text-xs text-slate-500">cumulé {formatNumber(r.cumulativeValue, unit)}</p> : null}
            </TD>
            <TD className="whitespace-nowrap">{READING_SOURCE[r.source] ?? r.source}</TD>
            <TD>
              <ReadingStatusBadge status={r.status} />
            </TD>
            <TD className="min-w-56">
              {r.statusReasons?.length ? (
                <p className="flex items-start gap-1 text-xs text-amber-800">
                  <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
                  {r.statusReasons.join(" ")}
                </p>
              ) : null}
              {r.comment ? <p className="text-xs text-slate-500">{r.comment}</p> : null}
              {r.status === "TO_CHECK" && canReview ? (
                <ActionForm action={reviewReadingAction.bind(null, r.id)} className="mt-2 flex flex-wrap items-center gap-2" showMessage>
                  <Input name="comment" placeholder="Commentaire" className="h-8 w-40" aria-label="Commentaire de vérification" />
                  <SubmitButton size="sm" variant="secondary" name="decision" value="VALID">
                    Valider
                  </SubmitButton>
                  <SubmitButton size="sm" variant="ghost" name="decision" value="REJECTED">
                    Rejeter
                  </SubmitButton>
                </ActionForm>
              ) : null}
            </TD>
          </TR>
        ))}
      </TBody>
    </Table>
  );
}

/* ------------------------------------------------------------------ */
/* Préventif (PRV-01, PRV-06)                                            */
/* ------------------------------------------------------------------ */

function DueItemsCard({ e, ctx, retired }: { e: Equipment; ctx: AuthContext; retired: boolean }) {
  const primary = e.meters[0];
  return (
    <Card>
      <CardHeader
        title="Préventif"
        description="Échéances ouvertes, au premier seuil atteint"
        actions={
          <Link href={`/preventif/echeances?equipmentId=${e.id}`} className="text-sm text-brand-700 hover:underline">
            Voir dans le module
          </Link>
        }
      />
      {e.dueItems.length === 0 ? (
        <EmptyState title="Aucune échéance" description="Appliquer un plan d'entretien pour générer les échéances." />
      ) : (
        <Table>
          <THead>
            <tr>
              <TH>Opération</TH>
              <TH>Échéance</TH>
              <TH>Prévision</TH>
              <TH>Statut</TH>
              <TH>OT</TH>
            </tr>
          </THead>
          <TBody>
            {e.dueItems.map((d) => (
              <TR key={d.id}>
                <TD>
                  <p className="text-slate-900">{d.operationName}</p>
                  <p className="text-xs text-slate-500">
                    {d.operationCode}
                    {d.isRegulatory ? " · réglementaire" : ""}
                  </p>
                </TD>
                <TD className="whitespace-nowrap">
                  {[d.dueMeterValue !== null ? formatNumber(d.dueMeterValue, primary?.unit) : null, d.dueDate ? formatDate(d.dueDate) : null]
                    .filter(Boolean)
                    .join(" ou ")}
                </TD>
                <TD className="whitespace-nowrap">{formatDate(d.projectedDate)}</TD>
                <TD>
                  <DueStatusBadge status={d.status} />
                </TD>
                <TD>
                  {d.workOrderId ? (
                    <Link href={`/ordres-de-travail/${d.workOrderId}`} className="text-brand-700 hover:underline">
                      Voir l&apos;OT
                    </Link>
                  ) : (
                    <span className="text-xs text-slate-400">Non généré</span>
                  )}
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}
      {!retired && ctx.canOn("plan.write", e) && e.availablePlans.length > 0 ? (
        <CardBody className="border-t border-slate-100">
          <Disclosure summary="Appliquer un plan d'entretien">
            <ActionForm action={applyPlanAction.bind(null, e.id)} className="grid gap-3 sm:grid-cols-3">
              <Field label="Plan" name="planId" required className="sm:col-span-3">
                <Select
                  id="planId"
                  name="planId"
                  required
                  placeholder="Choisir…"
                  options={e.availablePlans.map((p) => ({ value: p.id, label: p.name }))}
                />
              </Field>
              <Field label="Dernière réalisation" name="lastDoneAt" hint="Reprise de l'historique">
                <Input id="lastDoneAt" name="lastDoneAt" type="date" />
              </Field>
              <Field label={`Compteur à la dernière réalisation${primary ? ` (${primary.unit})` : ""}`} name="lastDoneMeter">
                <Input id="lastDoneMeter" name="lastDoneMeter" type="number" min={0} step="0.1" />
              </Field>
              <div className="flex items-end">
                <SubmitButton variant="secondary">Appliquer</SubmitButton>
              </div>
            </ActionForm>
          </Disclosure>
        </CardBody>
      ) : null}
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Interventions                                                         */
/* ------------------------------------------------------------------ */

function InterventionsCard({ e }: { e: Equipment }) {
  return (
    <Card>
      <CardHeader
        title="Interventions"
        description="DI ouvertes et 15 derniers OT"
        actions={
          <Link href={`/ordres-de-travail?equipmentId=${e.id}&status=ALL`} className="text-sm text-brand-700 hover:underline">
            Tous les OT
          </Link>
        }
      />
      {e.openRequests.length > 0 ? (
        <ul className="divide-y divide-slate-100 border-b border-slate-100 bg-amber-50/40 text-sm">
          {e.openRequests.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-2.5">
              <span>
                <Link href={`/demandes/${r.id}`} className="font-medium text-brand-700 hover:underline">
                  {r.number}
                </Link>{" "}
                {r.symptom}
              </span>
              <span className="flex items-center gap-2 text-xs text-slate-500">
                {formatDateTime(r.reportedAt)} <RequestStatusBadge status={r.status} />
              </span>
            </li>
          ))}
        </ul>
      ) : null}
      {e.recentWorkOrders.length === 0 ? (
        <EmptyState title="Aucun OT" />
      ) : (
        <Table>
          <THead>
            <tr>
              <TH>OT</TH>
              <TH>Type</TH>
              <TH>Priorité</TH>
              <TH>Statut</TH>
              <TH>Créé le</TH>
            </tr>
          </THead>
          <TBody>
            {e.recentWorkOrders.map((w) => (
              <TR key={w.id}>
                <TD>
                  <Link href={`/ordres-de-travail/${w.id}`} className="font-medium text-brand-700 hover:underline">
                    {w.number}
                  </Link>
                  <p className="max-w-72 truncate text-xs text-slate-500">{w.title}</p>
                </TD>
                <TD>{WORK_ORDER_TYPE[w.type] ?? w.type}</TD>
                <TD>
                  <PriorityBadge value={w.priority} short />
                </TD>
                <TD>
                  <WorkOrderStatusBadge status={w.status} />
                </TD>
                <TD className="whitespace-nowrap">{formatDate(w.createdAt)}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Affectations (EQP-10, DON-13)                                         */
/* ------------------------------------------------------------------ */

async function AssignmentCard({ e, ctx, retired }: { e: Equipment; ctx: AuthContext; retired: boolean }) {
  const canAssign = !retired && ctx.canOn("assignment.write", e);
  const [places, sites] = canAssign ? await Promise.all([listJobsitesAndWorkshopsForAssignment(ctx), listSites(ctx)]) : [null, []];
  const active = e.assignments.find((a) => a.id === e.activeAssignmentId);
  const place = (a: Equipment["assignments"][number]) => a.jobsite?.name ?? a.workshop?.name ?? a.site?.name ?? "—";
  return (
    <Card>
      <CardHeader title="Affectation" description="Une seule affectation active à la fois" />
      <CardBody className="space-y-4">
        {active ? (
          <div className="rounded-md bg-sky-50 px-3 py-2 text-sm text-sky-900">
            <p className="font-medium">{place(active)}</p>
            <p className="text-xs">
              Depuis le {formatDate(active.startAt)}
              {active.endAt ? ` jusqu'au ${formatDate(active.endAt)}` : ""}
            </p>
          </div>
        ) : (
          <p className="text-sm text-slate-500">Aucune affectation en cours.</p>
        )}
        {canAssign && active ? (
          <ActionForm action={endAssignmentAction.bind(null, e.id)}>
            <SubmitButton variant="secondary" size="sm">
              Terminer l&apos;affectation
            </SubmitButton>
          </ActionForm>
        ) : null}
        {canAssign && places ? (
          <Disclosure summary="Nouvelle affectation">
            <ActionForm action={assignEquipmentAction.bind(null, e.id)} className="space-y-3">
              <Field label="Chantier" name="jobsiteId">
                <Select id="jobsiteId" name="jobsiteId" placeholder="—" options={places.jobsites.map((j) => ({ value: j.id, label: j.name }))} />
              </Field>
              <Field label="ou site" name="siteId">
                <Select id="assign-siteId" name="siteId" placeholder="—" options={sites.map((s) => ({ value: s.id, label: s.name }))} />
              </Field>
              <Field label="ou atelier" name="workshopId">
                <Select id="workshopId" name="workshopId" placeholder="—" options={places.workshops.map((w) => ({ value: w.id, label: w.name }))} />
              </Field>
              <Field label="Début" name="startAt" required>
                <Input id="startAt" name="startAt" type="datetime-local" required defaultValue={toDateTimeInput(new Date())} />
              </Field>
              <Field label="Fin prévue" name="endAt">
                <Input id="endAt" name="endAt" type="datetime-local" />
              </Field>
              <SubmitButton variant="secondary">Affecter</SubmitButton>
            </ActionForm>
          </Disclosure>
        ) : null}
        {e.assignments.length > 0 ? (
          <ul className="divide-y divide-slate-100 text-sm">
            {e.assignments.map((a) => (
              <li key={a.id} className="flex justify-between gap-2 py-2">
                <span>{place(a)}</span>
                <span className="text-xs text-slate-500">
                  {formatDate(a.startAt)} → {a.endAt ? formatDate(a.endAt) : "en cours"}
                </span>
              </li>
            ))}
          </ul>
        ) : null}
      </CardBody>
    </Card>
  );
}
