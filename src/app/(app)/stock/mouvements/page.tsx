import Link from "next/link";
import { FilterBar, FilterField } from "@/components/filter-bar";
import { Forbidden } from "@/components/forbidden";
import { PageHeader } from "@/components/layout/page-header";
import { Select } from "@/components/ui/inputs";
import { Card, CardBody, CardHeader, EmptyState, Table, TBody, TD, TH, THead, TR } from "@/components/ui/primitives";
import { withParams } from "@/lib/utils";
import { formatCurrency, formatDateTime, formatNumber } from "@/lib/format";
import { MOVEMENT_TYPE } from "@/lib/labels";
import { getAuthContext } from "@/server/auth/session";
import { isUuid, queryParams } from "@/server/pages";
import { listWarehouses } from "@/server/services/organization";
import { listMovements, listPartOptions, listSupplierOptions } from "@/server/services/stock";
import { MovementForm } from "../movement-form";

export const metadata = { title: "Mouvements de stock" };

export default async function MovementsPage(props: PageProps<"/stock/mouvements">) {
  const ctx = await getAuthContext();
  if (!ctx.can("stock.read")) return <Forbidden what="les mouvements de stock" />;
  const raw = queryParams(await props.searchParams);
  const params = {
    partId: isUuid(raw.partId) ? raw.partId : undefined,
    warehouseId: isUuid(raw.warehouseId) ? raw.warehouseId : undefined,
    page: raw.page && /^\d+$/.test(raw.page) ? raw.page : undefined,
  };
  const types = [...(ctx.can("stock.move") ? ["RECEIPT", "TRANSFER", "SCRAP"] : []), ...(ctx.can("inventory.adjust") ? ["ADJUSTMENT"] : [])];
  const [movements, parts, warehouses, suppliers] = await Promise.all([
    listMovements(ctx, { ...params, pageSize: 50 }),
    listPartOptions(ctx),
    listWarehouses(ctx),
    types.length > 0 ? listSupplierOptions(ctx) : Promise.resolve([]),
  ]);
  const page = Number(params.page ?? 1);

  return (
    <>
      <PageHeader
        back={{ href: "/stock", label: "Pièces et stocks" }}
        title="Mouvements de stock"
        description="Journal des entrées et sorties. Le stock physique ne peut jamais devenir négatif ; chaque mouvement verrouille la ligne de stock (règles de §7.5)."
      />
      {types.length > 0 ? (
        <Card className="mb-6">
          <CardHeader title="Nouveau mouvement" />
          <CardBody>
            <MovementForm
              types={types}
              defaultPartId={params.partId}
              parts={parts.map((p) => ({ id: p.id, label: `${p.sku} — ${p.name} (${p.unit})` }))}
              warehouses={warehouses.map((w) => ({ id: w.id, label: `${w.name} — ${w.siteName}` }))}
              suppliers={suppliers.map((s) => ({ id: s.id, label: s.name }))}
            />
          </CardBody>
        </Card>
      ) : null}
      <Card>
        <FilterBar resetHref="/stock/mouvements">
          <FilterField label="Article" htmlFor="partId" className="w-72">
            <Select
              id="partId"
              name="partId"
              defaultValue={params.partId ?? ""}
              placeholder="Tous"
              options={parts.map((p) => ({ value: p.id, label: `${p.sku} — ${p.name}` }))}
            />
          </FilterField>
          <FilterField label="Magasin" htmlFor="warehouseId" className="w-64">
            <Select
              id="warehouseId"
              name="warehouseId"
              defaultValue={params.warehouseId ?? ""}
              placeholder="Tous"
              options={warehouses.map((w) => ({ value: w.id, label: w.name }))}
            />
          </FilterField>
        </FilterBar>
        {movements.length === 0 ? (
          <EmptyState title="Aucun mouvement" />
        ) : (
          <Table>
            <THead>
              <tr>
                <TH>Date</TH>
                <TH>Mouvement</TH>
                <TH>Article</TH>
                <TH>Magasin</TH>
                <TH className="text-right">Quantité</TH>
                <TH className="text-right">Coût unitaire</TH>
                <TH>Référence / OT</TH>
              </tr>
            </THead>
            <TBody>
              {movements.map((m) => (
                <TR key={m.id}>
                  <TD className="whitespace-nowrap">{formatDateTime(m.createdAt)}</TD>
                  <TD>{MOVEMENT_TYPE[m.type]?.label ?? m.type}</TD>
                  <TD>
                    <Link href={`/stock/articles/${m.partId}`} className="text-brand-700 hover:underline">
                      {m.sku}
                    </Link>
                    <p className="text-xs text-slate-500">{m.partName}</p>
                  </TD>
                  <TD>{m.warehouseName}</TD>
                  <TD className="text-right tabular-nums">{formatNumber(m.quantity, m.unit)}</TD>
                  <TD className="text-right tabular-nums">{formatCurrency(m.unitCost)}</TD>
                  <TD className="text-xs text-slate-600">
                    {m.workOrderId ? (
                      <Link href={`/ordres-de-travail/${m.workOrderId}`} className="text-brand-700 hover:underline">
                        {m.workOrderNumber}
                      </Link>
                    ) : (
                      [m.reference, m.reason].filter(Boolean).join(" — ")
                    )}
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
        <div className="flex justify-between border-t border-slate-100 px-5 py-3 text-sm">
          {page > 1 ? (
            <Link href={withParams("/stock/mouvements", { ...params, page: page - 1 })} className="text-brand-700 hover:underline">
              ← Plus récents
            </Link>
          ) : (
            <span />
          )}
          {movements.length === 50 ? (
            <Link href={withParams("/stock/mouvements", { ...params, page: page + 1 })} className="text-brand-700 hover:underline">
              Plus anciens →
            </Link>
          ) : null}
        </div>
      </Card>
    </>
  );
}
