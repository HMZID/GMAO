import Link from "next/link";
import { FilterBar, FilterField } from "@/components/filter-bar";
import { Forbidden } from "@/components/forbidden";
import { PageHeader } from "@/components/layout/page-header";
import { CriticalityBadge } from "@/components/status-badges";
import { ButtonLink } from "@/components/ui/button";
import { Checkbox, Input, Select } from "@/components/ui/inputs";
import { Pagination } from "@/components/ui/pagination";
import { Badge, Card, EmptyState, Table, TBody, TD, TH, THead, TR } from "@/components/ui/primitives";
import { formatCurrency, formatNumber } from "@/lib/format";
import { getAuthContext } from "@/server/auth/session";
import { cleanFilters, queryParams } from "@/server/pages";
import { listPartFamilies, listParts, partFilters } from "@/server/services/stock";

export const metadata = { title: "Pièces et stocks" };

export default async function PartsPage(props: PageProps<"/stock">) {
  const ctx = await getAuthContext();
  if (!ctx.can("part.read")) return <Forbidden what="le catalogue des pièces" />;
  const params = cleanFilters(partFilters, queryParams(await props.searchParams));
  const [page, families] = await Promise.all([listParts(ctx, params), listPartFamilies(ctx)]);

  return (
    <>
      <PageHeader
        title="Pièces et stocks"
        description="Catalogue, stock par magasin, réservations et seuils de réapprovisionnement (STK-01 à STK-08). Quantités dans votre périmètre."
        actions={
          <>
            {ctx.can("stock.read") ? (
              <ButtonLink href="/stock/mouvements" variant="secondary">
                Mouvements
              </ButtonLink>
            ) : null}
            {ctx.can("part.write") ? <ButtonLink href="/stock/articles/nouveau">Nouvel article</ButtonLink> : null}
          </>
        }
      />
      <Card>
        <FilterBar resetHref="/stock">
          <FilterField label="Recherche" htmlFor="q" className="w-64">
            <Input id="q" name="q" defaultValue={params.q} placeholder="Référence, désignation, réf. fabricant" />
          </FilterField>
          <FilterField label="Famille" htmlFor="family">
            <Select
              id="family"
              name="family"
              defaultValue={params.family ?? ""}
              placeholder="Toutes"
              options={families.map((f) => ({ value: f, label: f }))}
            />
          </FilterField>
          <Checkbox
            name="belowReorder"
            value="1"
            label="Sous le point de commande"
            defaultChecked={params.belowReorder === "1" || params.belowReorder === "true"}
            className="h-10"
          />
        </FilterBar>
        {page.items.length === 0 ? (
          <EmptyState title="Aucun article" />
        ) : (
          <Table>
            <THead>
              <tr>
                <TH>Référence</TH>
                <TH>Désignation</TH>
                <TH>Famille</TH>
                <TH className="text-right">En stock</TH>
                <TH className="text-right">Réservé</TH>
                <TH className="text-right">Disponible</TH>
                <TH className="text-right">Coût moyen</TH>
                <TH>Criticité</TH>
              </tr>
            </THead>
            <TBody>
              {page.items.map((p) => {
                const onHand = p.onHand ?? 0;
                const reserved = p.reserved ?? 0;
                return (
                  <TR key={p.id}>
                    <TD className="whitespace-nowrap">
                      <Link href={`/stock/articles/${p.id}`} className="font-medium text-brand-700 hover:underline">
                        {p.sku}
                      </Link>
                    </TD>
                    <TD>
                      {p.name}
                      <p className="text-xs text-slate-500">{[p.manufacturer, p.manufacturerRef].filter(Boolean).join(" · ")}</p>
                    </TD>
                    <TD>{p.family ?? "—"}</TD>
                    <TD className="text-right tabular-nums">{formatNumber(onHand, p.unit)}</TD>
                    <TD className="text-right tabular-nums text-slate-500">{formatNumber(reserved)}</TD>
                    <TD className="text-right tabular-nums">
                      {formatNumber(onHand - reserved)}
                      {p.belowReorder ? (
                        <Badge tone="amber" className="ml-2">
                          À commander
                        </Badge>
                      ) : null}
                    </TD>
                    <TD className="text-right tabular-nums">{formatCurrency(p.averageCost)}</TD>
                    <TD>
                      <CriticalityBadge value={p.criticality} />
                    </TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>
        )}
        <Pagination path="/stock" params={params} page={page.page} pageSize={page.pageSize} total={page.total} />
      </Card>
    </>
  );
}
