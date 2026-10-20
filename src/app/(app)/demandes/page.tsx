import Link from "next/link";
import { FilterBar, FilterField } from "@/components/filter-bar";
import { Forbidden } from "@/components/forbidden";
import { PageHeader } from "@/components/layout/page-header";
import { PriorityBadge, RequestStatusBadge } from "@/components/status-badges";
import { ButtonLink } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/inputs";
import { Pagination } from "@/components/ui/pagination";
import { Badge, Card, EmptyState, Table, TBody, TD, TH, THead, TR } from "@/components/ui/primitives";
import { formatDateTime } from "@/lib/format";
import { REQUEST_STATUS } from "@/lib/labels";
import { getAuthContext } from "@/server/auth/session";
import { cleanFilters, queryParams } from "@/server/pages";
import { listSites } from "@/server/services/organization";
import { listWorkRequests, workRequestFilters } from "@/server/services/work-requests";
import { T, Tr } from "@/i18n/client";

export const metadata = { title: "Demandes d'intervention" };

export default async function WorkRequestsPage(props: PageProps<"/demandes">) {
  const ctx = await getAuthContext();
  if (!ctx.can("request.read")) return <Forbidden what="les demandes d'intervention" />;
  const params = cleanFilters(workRequestFilters, queryParams(await props.searchParams));
  const [page, sites] = await Promise.all([listWorkRequests(ctx, params), listSites(ctx)]);

  return (
    <>
      <PageHeader
        title="Demandes d'intervention"
        description="Pannes et anomalies signalées, à qualifier puis à transformer en intervention à réaliser."
        actions={
          ctx.can("request.create") ? (
            <ButtonLink href="/demandes/nouvelle">
              <T>Créer une demande d&apos;intervention</T>
            </ButtonLink>
          ) : null
        }
      />
      <Card>
        <FilterBar resetHref="/demandes">
          <FilterField label="Recherche" htmlFor="q" className="w-64">
            <Input id="q" name="q" defaultValue={params.q} placeholder="N° de demande, symptôme, code équipement" />
          </FilterField>
          <FilterField label="Statut" htmlFor="status">
            <Select
              id="status"
              name="status"
              defaultValue={params.status ?? "OPEN"}
              options={[
                { value: "OPEN", label: "À traiter (nouvelles et qualifiées)" },
                ...Object.entries(REQUEST_STATUS).map(([value, v]) => ({ value, label: v.label })),
              ]}
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
        </FilterBar>
        {page.items.length === 0 ? (
          <EmptyState title="Aucune demande" description="Aucune demande ne correspond à ces filtres." />
        ) : (
          <Table>
            <THead>
              <tr>
                <TH>
                  <T>Demande</T>
                </TH>
                <TH>
                  <T>Équipement</T>
                </TH>
                <TH>
                  <T>Symptôme</T>
                </TH>
                <TH>
                  <T>Priorité</T>
                </TH>
                <TH>
                  <T>Signalée</T>
                </TH>
                <TH>
                  <T>Statut</T>
                </TH>
              </tr>
            </THead>
            <TBody>
              {page.items.map((r) => (
                <TR key={r.id}>
                  <TD className="whitespace-nowrap">
                    <Link href={`/demandes/${r.id}`} className="font-medium text-brand-700 hover:underline">
                      <Tr>{r.number}</Tr>
                    </Link>
                  </TD>
                  <TD>
                    <Link href={`/equipements/${r.equipmentId}`} className="hover:underline">
                      <Tr>{r.equipmentCode}</Tr>
                    </Link>
                    <p className="text-xs text-slate-500">
                      <Tr>{r.siteName}</Tr>
                    </p>
                  </TD>
                  <TD>
                    <p className="max-w-80 text-slate-900">
                      <Tr>{r.symptom}</Tr>
                    </p>
                    <div className="mt-1 flex gap-1">
                      {r.isStopped ? (
                        <Badge tone="red">
                          <T>Machine arrêtée</T>
                        </Badge>
                      ) : null}
                      {r.isSafetyRisk ? (
                        <Badge tone="red">
                          <T>Sécurité</T>
                        </Badge>
                      ) : null}
                    </div>
                  </TD>
                  <TD>
                    <PriorityBadge value={r.priority} />
                  </TD>
                  <TD className="whitespace-nowrap">
                    {formatDateTime(r.reportedAt)}
                    <p className="text-xs text-slate-500">
                      <Tr>{r.reportedByName}</Tr>
                    </p>
                  </TD>
                  <TD>
                    <RequestStatusBadge status={r.status} />
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
        <Pagination path="/demandes" params={params} page={page.page} pageSize={page.pageSize} total={page.total} />
      </Card>
    </>
  );
}
