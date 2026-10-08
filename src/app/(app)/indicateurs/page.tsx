import Link from "next/link";
import { FilterBar, FilterField } from "@/components/filter-bar";
import { Forbidden } from "@/components/forbidden";
import { PageHeader } from "@/components/layout/page-header";
import { Input, Select } from "@/components/ui/inputs";
import { Card, CardBody, CardHeader, EmptyState, StatTile, Table, TBody, TD, TH, THead, TR } from "@/components/ui/primitives";
import { formatCurrency, formatDate, formatHours, formatNumber, formatPercent, toDateInput } from "@/lib/format";
import { getAuthContext } from "@/server/auth/session";
import { cleanFilters, queryParams } from "@/server/pages";
import { getEquipmentFormOptions } from "@/server/services/equipment";
import { getIndicators, indicatorFilters } from "@/server/services/kpi";
import { listSites } from "@/server/services/organization";

export const metadata = { title: "Indicateurs" };

/**
 * Barre de magnitude dans une cellule de tableau : une seule série, une seule teinte,
 * extrémité arrondie ancrée à gauche ; la valeur est écrite en texte à côté (lecture sans couleur).
 */
function MagnitudeBar({ value, max, label }: { value: number; max: number; label: string }) {
  const width = max > 0 ? Math.max((value / max) * 100, value > 0 ? 2 : 0) : 0;
  return (
    <div className="h-2.5 w-16 shrink-0 rounded-sm bg-slate-100 sm:w-24" title={label} role="img" aria-label={label}>
      <div className="h-full rounded-r bg-brand-600" style={{ width: `${width}%` }} />
    </div>
  );
}

export default async function IndicatorsPage(props: PageProps<"/indicateurs">) {
  const ctx = await getAuthContext();
  if (!ctx.can("kpi.read")) return <Forbidden what="les indicateurs" />;
  const params = cleanFilters(indicatorFilters, queryParams(await props.searchParams));
  const [k, sites, opts] = await Promise.all([getIndicators(ctx, params), listSites(ctx), getEquipmentFormOptions(ctx)]);
  const costs = k.costs;
  const maxCategoryCost = Math.max(...k.byCategory.map((c) => c.cost), 0);
  const maxEquipmentCost = Math.max(...k.topCost.map((e) => e.cost), 0);
  const maxPartValue = Math.max(...k.topParts.map((p) => p.value), 0);

  return (
    <>
      <PageHeader
        title="Indicateurs de maintenance"
        description={`Période du ${formatDate(k.from)} au ${formatDate(k.to)} — ${k.fleetSize} équipement(s). Les indicateurs calculés sur moins de 3 événements sont « non significatifs » (CDC §9.2).`}
      />
      <Card className="mb-6">
        <FilterBar resetHref="/indicateurs">
          <FilterField label="Du" htmlFor="from" className="w-40">
            <Input id="from" name="from" type="date" defaultValue={params.from ?? toDateInput(k.from)} />
          </FilterField>
          <FilterField label="Au" htmlFor="to" className="w-40">
            <Input id="to" name="to" type="date" defaultValue={params.to ?? toDateInput(k.to)} />
          </FilterField>
          <FilterField label="Site" htmlFor="siteId">
            <Select
              id="siteId"
              name="siteId"
              defaultValue={params.siteId ?? ""}
              placeholder="Tous les sites"
              options={sites.map((s) => ({ value: s.id, label: s.name }))}
            />
          </FilterField>
          <FilterField label="Catégorie" htmlFor="categoryId">
            <Select
              id="categoryId"
              name="categoryId"
              defaultValue={params.categoryId ?? ""}
              placeholder="Toutes"
              options={opts.categories.map((c) => ({ value: c.id, label: c.label }))}
            />
          </FilterField>
        </FilterBar>
      </Card>

      {k.fleetSize === 0 ? (
        <Card>
          <EmptyState title="Aucun équipement dans ce périmètre" />
        </Card>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatTile
              label="Disponibilité"
              value={formatPercent(k.availability)}
              tone="teal"
              hint={`${formatNumber(k.downtimeHours)} h d'immobilisation sur la période`}
            />
            <StatTile
              label="MTBF"
              value={formatHours(k.mtbf)}
              tone="teal"
              hint={`${k.failures} panne(s), ${formatNumber(k.operatingHours)} h de fonctionnement`}
            />
            <StatTile label="MTTR" value={formatHours(k.mttr)} tone="teal" hint="Réparation active, attentes déduites" />
            <StatTile label="MDT" value={formatHours(k.mdt)} tone="teal" hint="Durée moyenne d'immobilisation par panne" />
            <StatTile
              label="Respect du préventif"
              value={formatPercent(k.preventive?.compliance)}
              tone="teal"
              hint={k.preventive ? `${k.preventive.doneOnTime} réalisée(s) à temps sur ${k.preventive.dueInPeriod} échue(s)` : undefined}
            />
            <StatTile
              label="Coût total de maintenance"
              value={formatCurrency(costs?.total)}
              tone="teal"
              hint="OT clôturés techniquement sur la période"
            />
            <StatTile label="Main-d'œuvre" value={formatCurrency(costs?.labor)} tone="gray" />
            <StatTile
              label="Pièces · prestataires · autres"
              value={formatCurrency((costs?.parts ?? 0) + (costs?.external ?? 0) + (costs?.other ?? 0))}
              tone="gray"
              hint={costs ? `${formatCurrency(costs.parts)} · ${formatCurrency(costs.external)} · ${formatCurrency(costs.other)}` : undefined}
            />
          </div>

          <div className="mt-6 grid gap-6 xl:grid-cols-2">
            <Card>
              <CardHeader title="Par catégorie" description="Disponibilité et coût de la période" />
              <Table>
                <THead>
                  <tr>
                    <TH>Catégorie</TH>
                    <TH className="text-right">Équip.</TH>
                    <TH className="text-right">Dispo.</TH>
                    <TH className="text-right">Immob.</TH>
                    <TH className="text-right">Coût</TH>
                  </tr>
                </THead>
                <TBody>
                  {k.byCategory.map((c) => (
                    <TR key={c.categoryId}>
                      <TD>{c.categoryName}</TD>
                      <TD className="text-right tabular-nums">{c.count}</TD>
                      <TD className="whitespace-nowrap text-right tabular-nums">{formatPercent(c.availability)}</TD>
                      <TD className="whitespace-nowrap text-right tabular-nums">{formatNumber(c.downtime, "h")}</TD>
                      <TD>
                        <div className="flex items-center justify-end gap-3 whitespace-nowrap">
                          <span className="tabular-nums text-slate-700">{formatCurrency(c.cost)}</span>
                          <MagnitudeBar value={c.cost} max={maxCategoryCost} label={`${c.categoryName} : ${formatCurrency(c.cost)}`} />
                        </div>
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </Card>

            <Card>
              <CardHeader title="Équipements les plus coûteux" description="Coût et immobilisation de la période (KPI-05)" />
              {k.topCost.length === 0 ? (
                <EmptyState title="Aucun coût sur la période" />
              ) : (
                <Table>
                  <THead>
                    <tr>
                      <TH>Équipement</TH>
                      <TH className="text-right">Immob.</TH>
                      <TH className="text-right">Coût</TH>
                    </tr>
                  </THead>
                  <TBody>
                    {k.topCost.map((e) => (
                      <TR key={e.id}>
                        <TD>
                          <Link href={`/equipements/${e.id}`} className="font-medium text-brand-700 hover:underline">
                            {e.code}
                          </Link>
                          <p className="text-xs text-slate-500">{e.categoryName}</p>
                        </TD>
                        <TD className="whitespace-nowrap text-right tabular-nums">{formatNumber(e.downtime, "h")}</TD>
                        <TD>
                          <div className="flex items-center justify-end gap-3 whitespace-nowrap">
                            <span className="tabular-nums text-slate-700">{formatCurrency(e.cost)}</span>
                            <MagnitudeBar value={e.cost} max={maxEquipmentCost} label={`${e.code} : ${formatCurrency(e.cost)}`} />
                          </div>
                        </TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>
              )}
            </Card>
          </div>

          <Card className="mt-6">
            <CardHeader title="Pièces les plus consommées" description="Valeur des sorties sur OT, retours déduits (KPI-07)" />
            {k.topParts.length === 0 ? (
              <EmptyState title="Aucune consommation sur la période" />
            ) : (
              <Table>
                <THead>
                  <tr>
                    <TH>Article</TH>
                    <TH className="text-right">Quantité</TH>
                    <TH className="text-right">Valeur</TH>
                  </tr>
                </THead>
                <TBody>
                  {k.topParts.map((p) => (
                    <TR key={p.partId}>
                      <TD>
                        <Link href={`/stock/articles/${p.partId}`} className="text-brand-700 hover:underline">
                          {p.sku}
                        </Link>{" "}
                        <span className="text-slate-600">{p.name}</span>
                      </TD>
                      <TD className="whitespace-nowrap text-right tabular-nums">{formatNumber(p.quantity, p.unit)}</TD>
                      <TD>
                        <div className="flex items-center justify-end gap-3 whitespace-nowrap">
                          <span className="tabular-nums text-slate-700">{formatCurrency(p.value)}</span>
                          <MagnitudeBar value={p.value} max={maxPartValue} label={`${p.sku} : ${formatCurrency(p.value)}`} />
                        </div>
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            )}
            <CardBody className="border-t border-slate-100 text-xs text-slate-500">
              Conventions (§9.2) : disponibilité sur 24 h × jours de la période ; MTBF = heures de fonctionnement ÷ nombre de pannes ; MTTR hors
              attentes de pièces ou de prestataire. Exports et coût par heure ou par kilomètre : itération suivante (KPI-08).
            </CardBody>
          </Card>
        </>
      )}
    </>
  );
}
