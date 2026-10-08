import Link from "next/link";
import { ActionForm, Field, SubmitButton } from "@/components/forms/action-form";
import { PageHeader } from "@/components/layout/page-header";
import { CriticalityBadge, EquipmentStatusBadge, PriorityBadge, RequestStatusBadge, WorkOrderStatusBadge } from "@/components/status-badges";
import { Checkbox, Select, Textarea } from "@/components/ui/inputs";
import { Alert, Badge, Card, CardBody, CardHeader, DescriptionList } from "@/components/ui/primitives";
import { formatDateTime, formatNumber } from "@/lib/format";
import { PRIORITY, REQUEST_TYPE, options } from "@/lib/labels";
import { getAuthContext } from "@/server/auth/session";
import { loadOr404 } from "@/server/pages";
import { getWorkRequest } from "@/server/services/work-requests";
import { convertWorkRequestAction, mergeWorkRequestAction, qualifyWorkRequestAction, rejectWorkRequestAction } from "../actions";

export const metadata = { title: "Demande d'intervention" };

export default async function WorkRequestPage(props: PageProps<"/demandes/[id]">) {
  const { id } = await props.params;
  const ctx = await getAuthContext();
  const r = await loadOr404(id, (x) => getWorkRequest(ctx, x));
  const sp = await props.searchParams;
  const open = r.status === "NEW" || r.status === "QUALIFIED";
  const canQualify = open && ctx.canOn("request.qualify", r);
  const canConvert = r.status === "QUALIFIED" && ctx.canOn("workorder.manage", r);
  const duplicates = r.otherOpenRequests.length + r.openOrders.length;

  return (
    <>
      <PageHeader
        back={{ href: "/demandes", label: "Demandes d'intervention" }}
        title={`${r.number} — ${r.symptom}`}
        meta={
          <>
            <RequestStatusBadge status={r.status} />
            <PriorityBadge value={r.priority} />
            {r.isStopped ? <Badge tone="red">Machine arrêtée</Badge> : null}
            {r.isSafetyRisk ? <Badge tone="red">Risque sécurité</Badge> : null}
          </>
        }
      />

      <div className="mb-6 space-y-3">
        {sp.cree ? (
          <Alert tone="green" title="Signalement enregistré">
            Les gestionnaires du site sont notifiés{r.priority === "P1" ? " en urgence" : ""}.
          </Alert>
        ) : null}
        {open && duplicates > 0 ? (
          <Alert tone="amber" title="Doublon possible (COR-02)">
            <p>D&apos;autres demandes ou OT sont ouverts sur cet équipement :</p>
            <ul className="mt-1 list-disc pl-5">
              {r.otherOpenRequests.map((o) => (
                <li key={o.id}>
                  <Link href={`/demandes/${o.id}`} className="underline">
                    {o.number}
                  </Link>{" "}
                  — {o.symptom} ({formatDateTime(o.reportedAt)})
                </li>
              ))}
              {r.openOrders.map((o) => (
                <li key={o.id}>
                  <Link href={`/ordres-de-travail/${o.id}`} className="underline">
                    {o.number}
                  </Link>{" "}
                  — {o.title}
                </li>
              ))}
            </ul>
          </Alert>
        ) : null}
        {r.status === "REJECTED" ? (
          <Alert tone="amber" title="Demande rejetée">
            {r.rejectionReason}
          </Alert>
        ) : null}
        {r.workOrder ? (
          <Alert tone="blue" title={r.status === "MERGED" ? "Rattachée à un OT existant" : "Transformée en OT"}>
            <Link href={`/ordres-de-travail/${r.workOrder.id}`} className="font-medium underline">
              {r.workOrder.number}
            </Link>{" "}
            <WorkOrderStatusBadge status={r.workOrder.status} />
          </Alert>
        ) : null}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Signalement" />
          <CardBody className="space-y-5">
            <DescriptionList
              items={[
                {
                  label: "Équipement",
                  value: (
                    <span className="flex flex-wrap items-center gap-2">
                      <Link href={`/equipements/${r.equipment.id}`} className="font-medium text-brand-700 hover:underline">
                        {r.equipment.code}
                      </Link>
                      {r.equipment.name}
                      <EquipmentStatusBadge status={r.equipment.status} />
                      <CriticalityBadge value={r.equipment.criticality} />
                    </span>
                  ),
                },
                { label: "Site", value: r.site.name },
                { label: "Signalée par", value: `${r.reportedBy?.name ?? "—"} le ${formatDateTime(r.reportedAt)}` },
                { label: "Relevé du compteur", value: r.meterValue !== null ? formatNumber(r.meterValue) : null },
                { label: "Type", value: r.type ? REQUEST_TYPE[r.type] : "À qualifier" },
                { label: "Immobilisation décidée", value: r.status === "NEW" ? "À qualifier" : r.immobilize ? "Oui" : "Non" },
                {
                  label: "Position",
                  value:
                    r.latitude !== null && r.longitude !== null ? (
                      <a
                        className="text-brand-700 hover:underline"
                        href={`https://www.openstreetmap.org/?mlat=${r.latitude}&mlon=${r.longitude}#map=16/${r.latitude}/${r.longitude}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {r.latitude.toFixed(4)}, {r.longitude.toFixed(4)}
                      </a>
                    ) : null,
                },
                { label: "Qualifiée le", value: r.qualifiedAt ? formatDateTime(r.qualifiedAt) : null },
              ]}
            />
            <div>
              <p className="text-xs font-medium text-slate-500">Description</p>
              <p className="mt-1 whitespace-pre-line text-sm text-slate-800">{r.description || "—"}</p>
            </div>
          </CardBody>
        </Card>

        <div className="space-y-6">
          {canQualify ? (
            <Card>
              <CardHeader title="Qualifier" description="Priorité, type et décision d'immobilisation (COR-03)" />
              <CardBody>
                <ActionForm action={qualifyWorkRequestAction.bind(null, r.id)} className="space-y-4">
                  <Field label="Priorité" name="priority" required>
                    <Select id="priority" name="priority" defaultValue={r.priority ?? "P3"} options={options(PRIORITY)} />
                  </Field>
                  <Field label="Type" name="type" required>
                    <Select
                      id="type"
                      name="type"
                      defaultValue={r.type ?? (r.isSafetyRisk ? "SAFETY" : "BREAKDOWN")}
                      options={options(REQUEST_TYPE)}
                    />
                  </Field>
                  <Checkbox name="immobilize" label="Immobiliser l'équipement" defaultChecked={r.immobilize || r.isStopped || r.isSafetyRisk} />
                  <SubmitButton>{r.status === "QUALIFIED" ? "Mettre à jour" : "Qualifier"}</SubmitButton>
                </ActionForm>
              </CardBody>
            </Card>
          ) : null}

          {canConvert ? (
            <Card>
              <CardHeader title="Créer l'OT" description="Un OT correctif reprend la priorité, le type et l'immobilisation" />
              <CardBody>
                <ActionForm action={convertWorkRequestAction.bind(null, r.id)}>
                  <SubmitButton>Transformer en OT</SubmitButton>
                </ActionForm>
              </CardBody>
            </Card>
          ) : null}

          {canQualify && r.openOrders.length > 0 ? (
            <Card>
              <CardHeader title="Rattacher à un OT ouvert" description="Doublon d'une panne déjà prise en charge" />
              <CardBody>
                <ActionForm action={mergeWorkRequestAction.bind(null, r.id)} className="space-y-3">
                  <Field label="OT" name="workOrderId" required>
                    <Select
                      id="workOrderId"
                      name="workOrderId"
                      required
                      options={r.openOrders.map((o) => ({ value: o.id, label: `${o.number} — ${o.title}` }))}
                    />
                  </Field>
                  <SubmitButton variant="secondary">Rattacher</SubmitButton>
                </ActionForm>
              </CardBody>
            </Card>
          ) : null}

          {canQualify ? (
            <Card>
              <CardHeader title="Rejeter" description="Le déclarant reçoit le motif" />
              <CardBody>
                <ActionForm action={rejectWorkRequestAction.bind(null, r.id)} className="space-y-3">
                  <Field label="Motif" name="reason" required>
                    <Textarea id="reason" name="reason" required rows={2} maxLength={500} />
                  </Field>
                  <SubmitButton variant="secondary">Rejeter la demande</SubmitButton>
                </ActionForm>
              </CardBody>
            </Card>
          ) : null}
        </div>
      </div>
    </>
  );
}
