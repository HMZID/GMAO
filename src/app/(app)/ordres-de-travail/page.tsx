import Link from "next/link";
import { FilterBar, FilterField } from "@/components/filter-bar";
import { Forbidden } from "@/components/forbidden";
import { PageHeader } from "@/components/layout/page-header";
import { PriorityBadge, WorkOrderStatusBadge } from "@/components/status-badges";
import { ButtonLink } from "@/components/ui/button";
import { Checkbox, Input, Select } from "@/components/ui/inputs";
import { Pagination } from "@/components/ui/pagination";
import { Badge, Card, EmptyState, Table, TBody, TD, TH, THead, TR } from "@/components/ui/primitives";
import { formatDate, formatDateTime } from "@/lib/format";
import { HOLD_REASON, PRIORITY, WORK_ORDER_STATUS, WORK_ORDER_TYPE, options } from "@/lib/labels";
import { getAuthContext } from "@/server/auth/session";
import { cleanFilters, queryParams } from "@/server/pages";
import { listSites } from "@/server/services/organization";
import { listWorkOrders, workOrderFilters } from "@/server/services/work-orders";

export const metadata = { title: "Ordres de travail" };

export default async function WorkOrdersPage(props: PageProps<"/ordres-de-travail">) {
  const ctx = await getAuthContext();
  if (!ctx.can("workorder.read")) return <Forbidden what="les ordres de travail" />;
  const params = cleanFilters(workOrderFilters, queryParams(await props.searchParams));
  const [page, sites] = await Promise.all([listWorkOrders(ctx, params), listSites(ctx)]);

  return (
    <>
      <PageHeader
        title="Ordres de travail"
        description="Interventions préventives, correctives et réglementaires, de la création à la clôture (COR-05 à COR-15)."
        actions={ctx.can("workorder.create") ? <ButtonLink href="/ordres-de-travail/nouveau">Nouvel OT</ButtonLink> : null}
      />
      <Card>
        <FilterBar resetHref="/ordres-de-travail">
          {params.equipmentId ? <input type="hidden" name="equipmentId" value={params.equipmentId} /> : null}
          <FilterField label="Recherche" htmlFor="q" className="w-56">
            <Input id="q" name="q" defaultValue={params.q} placeholder="N° d'OT, intitulé, équipement" />
          </FilterField>
          <FilterField label="Statut" htmlFor="status">
            <Select
              id="status"
              name="status"
              defaultValue={params.status ?? "OPEN"}
              options={[{ value: "OPEN", label: "Ouverts" }, { value: "ALL", label: "Tous" }, ...options(WORK_ORDER_STATUS)]}
            />
          </FilterField>
          <FilterField label="Type" htmlFor="type">
            <Select id="type" name="type" defaultValue={params.type ?? ""} placeholder="Tous" options={options(WORK_ORDER_TYPE)} />
          </FilterField>
          <FilterField label="Priorité" htmlFor="priority" className="w-36">
            <Select id="priority" name="priority" defaultValue={params.priority ?? ""} placeholder="Toutes" options={options(PRIORITY)} />
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
          {ctx.technicianId ? <Checkbox name="mine" value="1" label="Mes OT" defaultChecked={params.mine === "1"} className="h-10" /> : null}
        </FilterBar>
        {params.equipmentId ? (
          <p className="border-b border-slate-100 bg-slate-50 px-5 py-2 text-sm text-slate-600">
            Filtré sur un équipement ·{" "}
            <Link href="/ordres-de-travail" className="text-brand-700 hover:underline">
              retirer
            </Link>
          </p>
        ) : null}
        {page.items.length === 0 ? (
          <EmptyState title="Aucun ordre de travail" description="Aucun OT ne correspond à ces filtres." />
        ) : (
          <Table>
            <THead>
              <tr>
                <TH>OT</TH>
                <TH>Équipement</TH>
                <TH>Type</TH>
                <TH>Priorité</TH>
                <TH>Prévu</TH>
                <TH>Intervenants</TH>
                <TH>Statut</TH>
              </tr>
            </THead>
            <TBody>
              {page.items.map((w) => (
                <TR key={w.id}>
                  <TD>
                    <Link href={`/ordres-de-travail/${w.id}`} className="font-medium whitespace-nowrap text-brand-700 hover:underline">
                      {w.number}
                    </Link>
                    <p className="max-w-72 truncate text-xs text-slate-500">{w.title}</p>
                  </TD>
                  <TD>
                    <Link href={`/equipements/${w.equipmentId}`} className="hover:underline">
                      {w.equipmentCode}
                    </Link>
                    <p className="text-xs text-slate-500">{w.siteName}</p>
                  </TD>
                  <TD>
                    {WORK_ORDER_TYPE[w.type] ?? w.type}
                    <div className="mt-1 flex gap-1">
                      {w.isImmobilizing ? <Badge tone="red">Immobilisant</Badge> : null}
                      {w.isExternal ? <Badge tone="violet">Externe</Badge> : null}
                    </div>
                  </TD>
                  <TD>
                    <PriorityBadge value={w.priority} short />
                  </TD>
                  <TD className="whitespace-nowrap">
                    {w.plannedStart ? formatDateTime(w.plannedStart) : <span className="text-slate-400">À planifier</span>}
                  </TD>
                  <TD className="max-w-48 text-xs">{w.assignees ?? <span className="text-slate-400">—</span>}</TD>
                  <TD>
                    <WorkOrderStatusBadge status={w.status} />
                    {w.status === "ON_HOLD" && w.holdReason ? <p className="mt-1 text-xs text-amber-700">{HOLD_REASON[w.holdReason]}</p> : null}
                    <p className="mt-1 text-xs text-slate-400">créé le {formatDate(w.createdAt)}</p>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
        <Pagination path="/ordres-de-travail" params={params} page={page.page} pageSize={page.pageSize} total={page.total} />
      </Card>
    </>
  );
}
