import Link from "next/link";
import { FilterBar, FilterField } from "@/components/filter-bar";
import { Forbidden } from "@/components/forbidden";
import { ActionForm, Field, SubmitButton } from "@/components/forms/action-form";
import { PageHeader } from "@/components/layout/page-header";
import { DueStatusBadge } from "@/components/status-badges";
import { Disclosure } from "@/components/ui/disclosure";
import { Input, Select } from "@/components/ui/inputs";
import { Badge, Card, EmptyState, Table, TBody, TD, TH, THead, TR } from "@/components/ui/primitives";
import { formatDate, formatNumber, toDateInput } from "@/lib/format";
import { DUE_STATUS } from "@/lib/labels";
import { getAuthContext } from "@/server/auth/session";
import { cleanFilters, queryParams } from "@/server/pages";
import { listSites } from "@/server/services/organization";
import { dueFilters, listDueItems } from "@/server/services/preventive";
import { generateAction, postponeAction } from "../actions";

export const metadata = { title: "Échéances préventives" };

export default async function DueItemsPage(props: PageProps<"/preventif/echeances">) {
  const ctx = await getAuthContext();
  if (!ctx.can("plan.read")) return <Forbidden what="les échéances préventives" />;
  const params = cleanFilters(dueFilters, queryParams(await props.searchParams));
  const [items, sites] = await Promise.all([listDueItems(ctx, params), listSites(ctx)]);
  const canManage = ctx.can("workorder.manage");

  return (
    <>
      <PageHeader
        back={{ href: "/preventif", label: "Préventif" }}
        title="Échéances préventives"
        description="Triées par urgence puis par date prévue (date calendaire ou projection de l'usage du compteur)."
        actions={
          canManage ? (
            <ActionForm action={generateAction} showMessage>
              <SubmitButton>Générer les OT préventifs</SubmitButton>
            </ActionForm>
          ) : null
        }
      />
      <Card>
        <FilterBar resetHref="/preventif/echeances">
          {params.equipmentId ? <input type="hidden" name="equipmentId" value={params.equipmentId} /> : null}
          <FilterField label="Statut" htmlFor="status">
            <Select
              id="status"
              name="status"
              defaultValue={params.status ?? "OPEN"}
              options={[
                { value: "OPEN", label: "Toutes les ouvertes" },
                ...["OVERDUE", "DUE", "PRE_ALERT", "UPCOMING"].map((value) => ({ value, label: DUE_STATUS[value].label })),
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
        {items.length === 0 ? (
          <EmptyState title="Aucune échéance" />
        ) : (
          <Table>
            <THead>
              <tr>
                <TH>Équipement</TH>
                <TH>Opération</TH>
                <TH>Échéance</TH>
                <TH>Compteur actuel</TH>
                <TH>Prévue le</TH>
                <TH>Statut</TH>
                <TH>OT</TH>
              </tr>
            </THead>
            <TBody>
              {items.map((d) => (
                <TR key={d.id}>
                  <TD>
                    <Link href={`/equipements/${d.equipmentId}`} className="font-medium text-brand-700 hover:underline">
                      {d.equipmentCode}
                    </Link>
                    <p className="text-xs text-slate-500">{d.equipmentName}</p>
                  </TD>
                  <TD>
                    {d.operationName}
                    <p className="text-xs text-slate-500">
                      {d.operationCode}
                      {d.isRegulatory ? " · réglementaire" : ""}
                    </p>
                  </TD>
                  <TD className="whitespace-nowrap">
                    {[
                      d.dueMeterValue !== null ? formatNumber(d.dueMeterValue, d.meterUnit ?? undefined) : null,
                      d.dueDate ? formatDate(d.dueDate) : null,
                    ]
                      .filter(Boolean)
                      .join(" ou ")}
                    {d.postponedTo ? (
                      <Badge tone="amber" className="ml-1">
                        reportée au {formatDate(d.postponedTo)}
                      </Badge>
                    ) : null}
                  </TD>
                  <TD className="whitespace-nowrap tabular-nums">
                    {d.currentMeter !== null ? formatNumber(d.currentMeter, d.meterUnit ?? undefined) : "—"}
                  </TD>
                  <TD className="whitespace-nowrap">{formatDate(d.projectedDate)}</TD>
                  <TD>
                    <DueStatusBadge status={d.status} />
                  </TD>
                  <TD className="min-w-48">
                    {d.workOrderId ? (
                      <Link href={`/ordres-de-travail/${d.workOrderId}`} className="text-brand-700 hover:underline">
                        {d.workOrderNumber}
                      </Link>
                    ) : (
                      <span className="text-xs text-slate-400">Non généré</span>
                    )}
                    {canManage && !d.workOrderId ? (
                      <Disclosure summary="Reporter" className="mt-2">
                        <ActionForm action={postponeAction.bind(null, d.id)} className="space-y-2">
                          <Field label="Nouvelle date" name="postponedTo" required>
                            <Input id={`pp-${d.id}`} name="postponedTo" type="date" required defaultValue={toDateInput(d.postponedTo ?? d.dueDate)} />
                          </Field>
                          <Field label="Motif" name="reason" required>
                            <Input id={`ppr-${d.id}`} name="reason" required maxLength={500} />
                          </Field>
                          <SubmitButton size="sm" variant="secondary">
                            Reporter
                          </SubmitButton>
                        </ActionForm>
                      </Disclosure>
                    ) : null}
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </Card>
    </>
  );
}
