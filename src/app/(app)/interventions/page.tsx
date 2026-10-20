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
import { T } from "@/i18n/client";

export const metadata = { title: "Interventions à réaliser" };

export default async function WorkOrdersPage(props: PageProps<"/interventions">) {
  const ctx = await getAuthContext();
  if (!ctx.can("workorder.read")) return <Forbidden what="les interventions" />;
  const params = cleanFilters(workOrderFilters, queryParams(await props.searchParams));
  const [page, sites] = await Promise.all([listWorkOrders(ctx, params), listSites(ctx)]);

  return (
    <>
      <PageHeader
        title="Interventions à réaliser"
        description="Interventions préventives, correctives et réglementaires, de la création à la clôture."
        actions={
          ctx.can("workorder.create") ? (
            <ButtonLink href="/interventions/nouveau">
              <T>Nouvelle intervention à réaliser</T>
            </ButtonLink>
          ) : null
        }
      />
      <Card>
        <FilterBar resetHref="/interventions">
          {params.equipmentId ? <input type="hidden" name="equipmentId" value={params.equipmentId} /> : null}
          <FilterField label="Recherche" htmlFor="q" className="w-56">
            <Input id="q" name="q" defaultValue={params.q} placeholder="N° d'intervention, intitulé, équipement" />
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
          {ctx.technicianId ? (
            <Checkbox name="mine" value="1" label="Mes interventions à réaliser" defaultChecked={params.mine === "1"} className="h-10" />
          ) : null}
        </FilterBar>
        {params.equipmentId ? (
          <p className="border-b border-slate-100 bg-slate-50 px-5 py-2 text-sm text-slate-600">
            <T>Filtré sur un équipement ·</T>{" "}
            <Link href="/interventions" className="text-brand-700 hover:underline">
              <T>retirer</T>
            </Link>
          </p>
        ) : null}
        {page.items.length === 0 ? (
          <EmptyState title="Aucune intervention" description="Aucune intervention ne correspond à ces filtres." />
        ) : (
          <Table>
            <THead>
              <tr>
                <TH>
                  <T>Intervention</T>
                </TH>
                <TH>
                  <T>Équipement</T>
                </TH>
                <TH>
                  <T>Type</T>
                </TH>
                <TH>
                  <T>Priorité</T>
                </TH>
                <TH>
                  <T>Prévu</T>
                </TH>
                <TH>
                  <T>Intervenants</T>
                </TH>
                <TH>
                  <T>Statut</T>
                </TH>
              </tr>
            </THead>
            <TBody>
              {page.items.map((w) => (
                <TR key={w.id}>
                  <TD>
                    <Link href={`/interventions/${w.id}`} className="font-medium whitespace-nowrap text-brand-700 hover:underline">
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
                      {w.isImmobilizing ? (
                        <Badge tone="red">
                          <T>Immobilisant</T>
                        </Badge>
                      ) : null}
                      {w.isExternal ? (
                        <Badge tone="violet">
                          <T>Externe</T>
                        </Badge>
                      ) : null}
                    </div>
                  </TD>
                  <TD>
                    <PriorityBadge value={w.priority} short />
                  </TD>
                  <TD className="whitespace-nowrap">
                    {w.plannedStart ? (
                      formatDateTime(w.plannedStart)
                    ) : (
                      <span className="text-slate-400">
                        <T>À planifier</T>
                      </span>
                    )}
                  </TD>
                  <TD className="max-w-48 text-xs">{w.assignees ?? <span className="text-slate-400">—</span>}</TD>
                  <TD>
                    <WorkOrderStatusBadge status={w.status} />
                    {w.validationStatus === "PENDING" && !["CANCELLED", "CLOSED", "TECH_CLOSED"].includes(w.status) ? (
                      <p className="mt-1 text-xs font-medium text-amber-700">
                        <T>En attente de validation</T>
                      </p>
                    ) : null}
                    {w.status === "ON_HOLD" && w.holdReason ? <p className="mt-1 text-xs text-amber-700">{HOLD_REASON[w.holdReason]}</p> : null}
                    <p className="mt-1 text-xs text-slate-400">
                      <T params={{ date: formatDate(w.createdAt) }}>{"créé le {date}"}</T>
                    </p>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
        <Pagination path="/interventions" params={params} page={page.page} pageSize={page.pageSize} total={page.total} />
      </Card>
    </>
  );
}
