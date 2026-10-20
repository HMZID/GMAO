import Link from "next/link";
import { ActionForm, Field, SubmitButton } from "@/components/forms/action-form";
import { PageHeader } from "@/components/layout/page-header";
import { CriticalityBadge, EquipmentStatusBadge, PriorityBadge, RequestStatusBadge, WorkOrderStatusBadge } from "@/components/status-badges";
import { Checkbox, Select, Textarea } from "@/components/ui/inputs";
import { ApprovalCard } from "@/components/approvals/approval-card";
import { Alert, Badge, Card, CardBody, CardHeader, DescriptionList } from "@/components/ui/primitives";
import { formatDateTime, formatNumber } from "@/lib/format";
import { PRIORITY, REQUEST_TYPE, options } from "@/lib/labels";
import { getAuthContext } from "@/server/auth/session";
import { loadOr404 } from "@/server/pages";
import { getWorkRequest } from "@/server/services/work-requests";
import { convertWorkRequestAction, mergeWorkRequestAction, qualifyWorkRequestAction, rejectWorkRequestAction } from "../actions";
import { T, Tr } from "@/i18n/client";

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
            {r.isStopped ? (
              <Badge tone="red">
                <T>Machine arrêtée</T>
              </Badge>
            ) : null}
            {r.isSafetyRisk ? (
              <Badge tone="red">
                <T>Risque sécurité</T>
              </Badge>
            ) : null}
          </>
        }
      />

      <div className="mb-6 space-y-3">
        {sp.cree ? (
          <Alert tone="green" title="Signalement enregistré">
            <T>{r.priority === "P1" ? "Les gestionnaires du site sont notifiés en urgence." : "Les gestionnaires du site sont notifiés."}</T>
          </Alert>
        ) : null}
        {open && duplicates > 0 ? (
          <Alert tone="amber" title="Doublon possible">
            <p>
              <T>D&apos;autres demandes ou interventions sont ouvertes sur cet équipement :</T>
            </p>
            <ul className="mt-1 list-disc ps-5">
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
                  <Link href={`/interventions/${o.id}`} className="underline">
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
          <Alert
            tone="blue"
            title={r.status === "MERGED" ? "Rattachée à une intervention à réaliser existante" : "Transformée en intervention à réaliser"}
          >
            <Link href={`/interventions/${r.workOrder.id}`} className="font-medium underline">
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
              <p className="text-xs font-medium text-slate-500">
                <T>Description</T>
              </p>
              <p className="mt-1 whitespace-pre-line text-sm text-slate-800">{r.description || "—"}</p>
            </div>
          </CardBody>
        </Card>

        <div className="space-y-6">
          <ApprovalCard approvals={r.approvals} />
          {canQualify ? (
            <Card>
              <CardHeader title="Qualifier" description="Priorité, type et décision d'immobilisation" />
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
                  <SubmitButton>
                    <Tr>{r.status === "QUALIFIED" ? "Mettre à jour" : "Qualifier"}</Tr>
                  </SubmitButton>
                </ActionForm>
              </CardBody>
            </Card>
          ) : null}

          {canConvert ? (
            <Card>
              <CardHeader
                title="Créer l'intervention à réaliser"
                description="L'intervention corrective reprend la priorité, le type et l'immobilisation"
              />
              <CardBody>
                <ActionForm action={convertWorkRequestAction.bind(null, r.id)}>
                  <SubmitButton>
                    <T>Transformer en intervention à réaliser</T>
                  </SubmitButton>
                </ActionForm>
              </CardBody>
            </Card>
          ) : null}

          {canQualify && r.openOrders.length > 0 ? (
            <Card>
              <CardHeader title="Rattacher à une intervention à réaliser existante" description="Doublon d'une panne déjà prise en charge" />
              <CardBody>
                <ActionForm action={mergeWorkRequestAction.bind(null, r.id)} className="space-y-3">
                  <Field label="Intervention à réaliser" name="workOrderId" required>
                    <Select
                      id="workOrderId"
                      name="workOrderId"
                      required
                      options={r.openOrders.map((o) => ({ value: o.id, label: `${o.number} — ${o.title}` }))}
                    />
                  </Field>
                  <SubmitButton variant="secondary">
                    <T>Rattacher</T>
                  </SubmitButton>
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
                  <SubmitButton variant="secondary">
                    <T>Rejeter la demande</T>
                  </SubmitButton>
                </ActionForm>
              </CardBody>
            </Card>
          ) : null}
        </div>
      </div>
    </>
  );
}
