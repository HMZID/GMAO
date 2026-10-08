import Link from "next/link";
import { FilterBar, FilterField } from "@/components/filter-bar";
import { PageHeader } from "@/components/layout/page-header";
import { CriticalityBadge, EquipmentStatusBadge } from "@/components/status-badges";
import { ButtonLink } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/inputs";
import { Pagination } from "@/components/ui/pagination";
import { Card, EmptyState, Table, TBody, TD, TH, THead, TR } from "@/components/ui/primitives";
import { Forbidden } from "@/components/forbidden";
import { formatNumber } from "@/lib/format";
import { EQUIPMENT_STATUS, options } from "@/lib/labels";
import { getAuthContext } from "@/server/auth/session";
import { cleanFilters, queryParams } from "@/server/pages";
import { equipmentFilters, getEquipmentFormOptions, listEquipment } from "@/server/services/equipment";
import { listSites } from "@/server/services/organization";

export const metadata = { title: "Équipements" };

export default async function EquipmentListPage(props: PageProps<"/equipements">) {
  const ctx = await getAuthContext();
  if (!ctx.can("equipment.read")) return <Forbidden what="la liste des équipements" />;
  const params = cleanFilters(equipmentFilters, queryParams(await props.searchParams));
  const [page, sites, formOptions] = await Promise.all([listEquipment(ctx, params), listSites(ctx), getEquipmentFormOptions(ctx)]);

  return (
    <>
      <PageHeader
        title="Équipements"
        description="Parc d'engins, véhicules et équipements dans votre périmètre."
        actions={ctx.can("equipment.write") ? <ButtonLink href="/equipements/nouveau">Nouvel équipement</ButtonLink> : null}
      />
      <Card>
        <FilterBar resetHref="/equipements">
          <FilterField label="Recherche" htmlFor="q" className="w-64">
            <Input id="q" name="q" defaultValue={params.q} placeholder="Code, désignation, n° de série, immat." />
          </FilterField>
          <FilterField label="État" htmlFor="status">
            <Select
              id="status"
              name="status"
              defaultValue={params.status ?? ""}
              placeholder="Tous (hors réformés)"
              options={options(EQUIPMENT_STATUS)}
            />
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
              options={formOptions.categories.map((c) => ({ value: c.id, label: c.label }))}
            />
          </FilterField>
          <FilterField label="Criticité" htmlFor="criticality" className="w-32">
            <Select
              id="criticality"
              name="criticality"
              defaultValue={params.criticality ?? ""}
              placeholder="Toutes"
              options={["A", "B", "C"].map((c) => ({ value: c, label: c }))}
            />
          </FilterField>
        </FilterBar>
        {page.items.length === 0 ? (
          <EmptyState title="Aucun équipement" description="Aucun équipement ne correspond à ces filtres dans votre périmètre." />
        ) : (
          <Table>
            <THead>
              <tr>
                <TH>Code</TH>
                <TH>Désignation</TH>
                <TH>Catégorie</TH>
                <TH>Site</TH>
                <TH>Compteur</TH>
                <TH>Criticité</TH>
                <TH>État</TH>
              </tr>
            </THead>
            <TBody>
              {page.items.map((e) => (
                <TR key={e.id}>
                  <TD>
                    <Link href={`/equipements/${e.id}`} className="font-medium text-brand-700 hover:underline">
                      {e.code}
                    </Link>
                  </TD>
                  <TD>
                    <p className="text-slate-900">{e.name}</p>
                    <p className="text-xs text-slate-500">
                      {[e.manufacturer, e.modelName].filter(Boolean).join(" ")}
                      {e.registration ? ` · ${e.registration}` : ""}
                    </p>
                  </TD>
                  <TD>{e.categoryName}</TD>
                  <TD>
                    {e.siteName}
                    <p className="text-xs text-slate-500">{e.companyName}</p>
                  </TD>
                  <TD className="whitespace-nowrap tabular-nums">{formatNumber(e.primaryMeterValue, e.primaryMeterUnit ?? undefined)}</TD>
                  <TD>
                    <CriticalityBadge value={e.criticality} />
                  </TD>
                  <TD>
                    <EquipmentStatusBadge status={e.status} />
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
        <Pagination path="/equipements" params={params} page={page.page} pageSize={page.pageSize} total={page.total} />
      </Card>
    </>
  );
}
