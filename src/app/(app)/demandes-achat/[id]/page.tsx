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
import { T, Tr } from "@/i18n/client";

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
            <Tr>{pr.number}</Tr>
            <span className="text-lg font-normal text-slate-600">
              <Tr>{pr.description}</Tr>
            </span>
          </span>
        }
        meta={
          <>
            <Badge tone={PURCHASE_REQUEST_STATUS[pr.status]?.tone}>
              <Tr>{PURCHASE_REQUEST_STATUS[pr.status]?.label}</Tr>
            </Badge>
            <span className="text-sm text-slate-500">
              <Tr>{pr.requester}</Tr> · {formatDateTime(pr.createdAt)} · <Tr>{pr.siteName}</Tr> (<Tr>{pr.companyName}</Tr>)
            </span>
          </>
        }
      />
      {pr.status === "CANCELLED" && pr.cancellationReason ? (
        <div className="mb-6">
          <Alert tone="amber" title="Demande annulée">
            <Tr>{pr.cancellationReason}</Tr>
          </Alert>
        </div>
      ) : null}
      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <ApprovalCard approvals={pr.approvals} />
          {pr.approvals.length === 0 && pr.status === "APPROVED" ? (
            <Alert tone="green" title="Validée d'office">
              <T>Aucune étape du circuit ne s&apos;applique à ce montant.</T>
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
                    label: "Intervention à réaliser",
                    value: pr.workOrder ? (
                      <Link href={`/interventions/${pr.workOrder.id}`} className="text-brand-700 hover:underline">
                        <Tr>{pr.workOrder.number}</Tr> — <Tr>{pr.workOrder.title}</Tr>
                      </Link>
                    ) : null,
                  },
                  {
                    label: "Équipement",
                    value: pr.equipment ? (
                      <Link href={`/equipements/${pr.equipment.id}`} className="text-brand-700 hover:underline">
                        <Tr>{pr.equipment.code}</Tr> — <Tr>{pr.equipment.name}</Tr>
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
                <SubmitButton variant="danger">
                  <T>Annuler la demande</T>
                </SubmitButton>
              </ActionForm>
            </Disclosure>
          ) : null}
        </div>
      </div>
    </>
  );
}
