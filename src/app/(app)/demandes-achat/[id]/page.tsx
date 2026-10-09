import Link from "next/link";
import { ApprovalCard } from "@/components/approvals/approval-card";
import { ActionForm, Field, SubmitButton } from "@/components/forms/action-form";
import { PageHeader } from "@/components/layout/page-header";
import { Disclosure } from "@/components/ui/disclosure";
import { Input } from "@/components/ui/inputs";
import { Alert, Badge, Card, CardBody, CardHeader, DescriptionList } from "@/components/ui/primitives";
import { formatCurrency, formatDate, formatDateTime, formatNumber } from "@/lib/format";
import { PURCHASE_REQUEST_STATUS } from "@/lib/labels";
import { getAuthContext } from "@/server/auth/session";
import { loadOr404 } from "@/server/pages";
import { getPurchaseRequest } from "@/server/services/purchase-requests";
import { cancelPurchaseRequestAction } from "../actions";

export const metadata = { title: "Demande d'achat" };

export default async function PurchaseRequestPage(props: PageProps<"/demandes-achat/[id]">) {
  const { id } = await props.params;
  const ctx = await getAuthContext();
  const pr = await loadOr404(id, (x) => getPurchaseRequest(ctx, x));

  return (
    <>
      <PageHeader
        back={{ href: "/demandes-achat", label: "Demandes d'achat" }}
        title={
          <span className="flex flex-wrap items-baseline gap-3">
            {pr.number}
            <span className="text-lg font-normal text-slate-600">{pr.description}</span>
          </span>
        }
        meta={
          <>
            <Badge tone={PURCHASE_REQUEST_STATUS[pr.status]?.tone}>{PURCHASE_REQUEST_STATUS[pr.status]?.label}</Badge>
            <span className="text-sm text-slate-500">
              {pr.requester} · {formatDateTime(pr.createdAt)} · {pr.siteName} ({pr.companyName})
            </span>
          </>
        }
      />
      {pr.status === "CANCELLED" && pr.cancellationReason ? (
        <div className="mb-6">
          <Alert tone="amber" title="Demande annulée">
            {pr.cancellationReason}
          </Alert>
        </div>
      ) : null}
      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <ApprovalCard approvals={pr.approvals} />
          {pr.approvals.length === 0 && pr.status === "APPROVED" ? (
            <Alert tone="green" title="Validée d'office">
              Aucune étape du circuit ne s&apos;applique à ce montant.
            </Alert>
          ) : null}
        </div>
        <div className="space-y-6">
          <Card>
            <CardHeader title="Besoin" />
            <CardBody>
              <DescriptionList
                columns={1}
                items={[
                  { label: "Article", value: pr.part ? `${pr.part.sku} — ${pr.part.name}` : "Hors catalogue" },
                  { label: "Quantité", value: formatNumber(pr.quantity) },
                  { label: "Prix unitaire estimé", value: formatCurrency(pr.estimatedUnitPrice) },
                  { label: "Montant estimé", value: <strong>{formatCurrency(pr.amount)}</strong> },
                  { label: "Fournisseur suggéré", value: pr.supplier?.name },
                  { label: "Date de besoin", value: pr.neededBy ? formatDate(pr.neededBy) : null },
                  {
                    label: "Ordre de travail",
                    value: pr.workOrder ? (
                      <Link href={`/ordres-de-travail/${pr.workOrder.id}`} className="text-brand-700 hover:underline">
                        {pr.workOrder.number} — {pr.workOrder.title}
                      </Link>
                    ) : null,
                  },
                  {
                    label: "Équipement",
                    value: pr.equipment ? (
                      <Link href={`/equipements/${pr.equipment.id}`} className="text-brand-700 hover:underline">
                        {pr.equipment.code} — {pr.equipment.name}
                      </Link>
                    ) : null,
                  },
                  { label: "Centre de coût", value: pr.costCenter ? `${pr.costCenter.code} — ${pr.costCenter.name}` : null },
                ]}
              />
            </CardBody>
          </Card>
          {pr.canCancel ? (
            <Disclosure summary="Annuler la demande">
              <ActionForm action={cancelPurchaseRequestAction.bind(null, pr.id)} className="space-y-3">
                <Field label="Motif" name="reason" required>
                  <Input name="reason" required maxLength={500} />
                </Field>
                <SubmitButton variant="danger">Annuler la demande</SubmitButton>
              </ActionForm>
            </Disclosure>
          ) : null}
        </div>
      </div>
    </>
  );
}
