import { FilterBar, FilterField } from "@/components/filter-bar";
import { Forbidden } from "@/components/forbidden";
import { PageHeader } from "@/components/layout/page-header";
import { Input, Select } from "@/components/ui/inputs";
import { Card, EmptyState, Table, TBody, TD, TH, THead, TR } from "@/components/ui/primitives";
import Link from "next/link";
import { formatDateTime } from "@/lib/format";
import { AUDIT_CHANNEL, ENTITY_TYPE } from "@/lib/labels";
import { withParams } from "@/lib/utils";
import { getAuthContext } from "@/server/auth/session";
import { cleanFilters, queryParams } from "@/server/pages";
import { auditFilters, listAuditLogs } from "@/server/services/users";

export const metadata = { title: "Journal d'audit" };

const PAGE_SIZE = 50;

/** Aperçu lisible d'un état avant / après (JSON tronqué). */
function preview(value: unknown) {
  if (value === null || value === undefined) return null;
  const text = JSON.stringify(value, null, 2);
  return text.length > 2_000 ? `${text.slice(0, 2_000)}\n…` : text;
}

export default async function AuditPage(props: PageProps<"/administration/journal">) {
  const ctx = await getAuthContext();
  if (!ctx.can("audit.read")) return <Forbidden what="le journal d'audit" />;
  const params = cleanFilters(auditFilters, queryParams(await props.searchParams));
  const rows = await listAuditLogs(ctx, { ...params, pageSize: PAGE_SIZE });
  const page = Number(params.page ?? 1);

  return (
    <>
      <PageHeader
        back={{ href: "/administration", label: "Administration" }}
        title="Journal d'audit"
        description="Ajout seul : aucune ligne ne peut être modifiée ni supprimée, y compris par l'API (HAB-06, TEC-05)."
      />
      <Card>
        <FilterBar resetHref="/administration/journal">
          <FilterField label="Objet" htmlFor="entityType" className="w-56">
            <Select
              id="entityType"
              name="entityType"
              defaultValue={params.entityType ?? ""}
              placeholder="Tous"
              options={Object.entries(ENTITY_TYPE).map(([value, label]) => ({ value, label }))}
            />
          </FilterField>
          <FilterField label="Identifiant" htmlFor="entityId" className="w-80">
            <Input id="entityId" name="entityId" defaultValue={params.entityId} placeholder="UUID de l'objet" />
          </FilterField>
        </FilterBar>
        {rows.length === 0 ? (
          <EmptyState title="Aucune entrée" />
        ) : (
          <Table>
            <THead>
              <tr>
                <TH>Date</TH>
                <TH>Utilisateur</TH>
                <TH>Canal</TH>
                <TH>Objet</TH>
                <TH>Action</TH>
                <TH>Détail</TH>
              </tr>
            </THead>
            <TBody>
              {rows.map((r) => (
                <TR key={r.id}>
                  <TD className="whitespace-nowrap">{formatDateTime(r.createdAt)}</TD>
                  <TD>{r.userName ?? "Système"}</TD>
                  <TD>{AUDIT_CHANNEL[r.channel] ?? r.channel}</TD>
                  <TD>
                    {ENTITY_TYPE[r.entityType] ?? r.entityType}
                    <p>
                      <Link
                        href={withParams("/administration/journal", { entityId: r.entityId })}
                        className="font-mono text-[11px] text-slate-500 hover:underline"
                      >
                        {r.entityId.slice(0, 8)}…
                      </Link>
                    </p>
                  </TD>
                  <TD className="font-mono text-xs">{r.action}</TD>
                  <TD className="max-w-md">
                    {r.before || r.after ? (
                      <details>
                        <summary className="cursor-pointer text-xs text-brand-700">Avant / après</summary>
                        <div className="mt-2 grid gap-2">
                          {r.before ? <pre className="max-h-64 overflow-auto rounded bg-slate-50 p-2 text-[11px]">{preview(r.before)}</pre> : null}
                          {r.after ? <pre className="max-h-64 overflow-auto rounded bg-emerald-50 p-2 text-[11px]">{preview(r.after)}</pre> : null}
                        </div>
                      </details>
                    ) : null}
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
        <div className="flex justify-between border-t border-slate-100 px-5 py-3 text-sm">
          {page > 1 ? (
            <Link href={withParams("/administration/journal", { ...params, page: page - 1 })} className="text-brand-700 hover:underline">
              ← Plus récentes
            </Link>
          ) : (
            <span />
          )}
          {rows.length === PAGE_SIZE ? (
            <Link href={withParams("/administration/journal", { ...params, page: page + 1 })} className="text-brand-700 hover:underline">
              Plus anciennes →
            </Link>
          ) : null}
        </div>
      </Card>
    </>
  );
}
