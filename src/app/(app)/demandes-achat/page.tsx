import Link from "next/link";
import { FilterBar, FilterField } from "@/components/filter-bar";
import { Forbidden } from "@/components/forbidden";
import { PageHeader } from "@/components/layout/page-header";
import { ButtonLink } from "@/components/ui/button";
import { Checkbox, Select } from "@/components/ui/inputs";
import { Pagination } from "@/components/ui/pagination";
import { Badge, Card, EmptyState, Table, TBody, TD, TH, THead, TR } from "@/components/ui/primitives";
import { formatCurrency, formatDate, formatDateTime, formatNumber } from "@/lib/format";
import { PURCHASE_REQUEST_STATUS } from "@/lib/labels";
import { getAuthContext } from "@/server/auth/session";
import { cleanFilters, queryParams } from "@/server/pages";
import { listPurchaseRequests, purchaseRequestFilters } from "@/server/services/purchase-requests";

export const metadata = { title: "Demandes d'achat" };

export default async function PurchaseRequestsPage(props: PageProps<"/demandes-achat">) {
  const ctx = await getAuthContext();
  if (!ctx.can("purchase.read")) return <Forbidden what="les demandes d'achat" />;
  const params = cleanFilters(purchaseRequestFilters, queryParams(await props.searchParams));
  const page = await listPurchaseRequests(ctx, params);

  return (
    <>
      <PageHeader
        title="Demandes d'achat"
        description="Pièces et prestations à acheter, rattachées à un OT, un équipement ou un centre de coût, puis validées selon les seuils (ACH-01, ACH-02)."
        actions={ctx.can("purchase.create") ? <ButtonLink href="/demandes-achat/nouvelle">Nouvelle demande</ButtonLink> : null}
      />
      <Card>
        <FilterBar resetHref="/demandes-achat">
          <FilterField label="Statut" htmlFor="status">
            <Select
              id="status"
              name="status"
              defaultValue={params.status ?? ""}
              placeholder="Tous les statuts"
              options={Object.entries(PURCHASE_REQUEST_STATUS).map(([value, v]) => ({ value, label: v.label }))}
            />
          </FilterField>
          <FilterField label="Demandeur" htmlFor="mine">
            <Checkbox id="mine" name="mine" value="true" defaultChecked={params.mine === "true"} label="Mes demandes" />
          </FilterField>
        </FilterBar>
        {page.items.length === 0 ? (
          <EmptyState title="Aucune demande d'achat" />
        ) : (
          <Table>
            <THead>
              <tr>
                <TH>Demande</TH>
                <TH>Objet</TH>
                <TH className="text-right">Quantité</TH>
                <TH className="text-right">Montant estimé</TH>
                <TH>Besoin</TH>
                <TH>Statut</TH>
              </tr>
            </THead>
            <TBody>
              {page.items.map((r) => (
                <TR key={r.id}>
                  <TD className="whitespace-nowrap">
                    <Link href={`/demandes-achat/${r.id}`} className="font-medium text-brand-700 hover:underline">
                      {r.number}
                    </Link>
                    <p className="text-xs text-slate-500">
                      {r.requester} · {formatDateTime(r.createdAt)}
                    </p>
                  </TD>
                  <TD>
                    <p className="max-w-80 text-slate-900">{r.description}</p>
                    <p className="text-xs text-slate-500">{r.companyName}</p>
                  </TD>
                  <TD className="text-right tabular-nums">{formatNumber(r.quantity)}</TD>
                  <TD className="text-right tabular-nums">{formatCurrency(r.amount)}</TD>
                  <TD className="whitespace-nowrap">{r.neededBy ? formatDate(r.neededBy) : "—"}</TD>
                  <TD>
                    <Badge tone={PURCHASE_REQUEST_STATUS[r.status]?.tone}>{PURCHASE_REQUEST_STATUS[r.status]?.label}</Badge>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
        <Pagination path="/demandes-achat" params={params} page={page.page} pageSize={page.pageSize} total={page.total} />
      </Card>
    </>
  );
}
