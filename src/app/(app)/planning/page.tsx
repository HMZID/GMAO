import Link from "next/link";
import { FilterField } from "@/components/filter-bar";
import { Forbidden } from "@/components/forbidden";
import { PageHeader } from "@/components/layout/page-header";
import { PriorityBadge, WorkOrderStatusBadge } from "@/components/status-badges";
import { ButtonLink } from "@/components/ui/button";
import { Select } from "@/components/ui/inputs";
import { Badge, Card, CardHeader, EmptyState, Table, TBody, TD, TH, THead, TR } from "@/components/ui/primitives";
import { formatDay, formatMinutes, formatNumber, formatPercent } from "@/lib/format";
import { ABSENCE_TYPE } from "@/lib/labels";
import { cn, withParams } from "@/lib/utils";
import { getAuthContext } from "@/server/auth/session";
import { cleanFilters, queryParams } from "@/server/pages";
import { listSites } from "@/server/services/organization";
import { EMERGENCY_RESERVE, getWeekPlanning, weekInput } from "@/server/services/planning";

export const metadata = { title: "Planning" };

const TIME_ZONE = process.env.NEXT_PUBLIC_DEFAULT_TIMEZONE ?? "Europe/Paris";
const dayKeyFmt = new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" });
const timeFmt = new Intl.DateTimeFormat("fr-FR", { timeZone: TIME_ZONE, hour: "2-digit", minute: "2-digit" });
const iso = (d: Date) => d.toISOString().slice(0, 10);

export default async function PlanningPage(props: PageProps<"/planning">) {
  const ctx = await getAuthContext();
  if (!ctx.can("planning.read")) return <Forbidden what="le planning" />;
  const params = cleanFilters(weekInput, queryParams(await props.searchParams));
  const [plan, sites] = await Promise.all([getWeekPlanning(ctx, params), listSites(ctx)]);
  const prev = iso(new Date(plan.weekStart.getTime() - 7 * 86_400_000));
  const next = iso(new Date(plan.weekStart.getTime() + 7 * 86_400_000));
  const today = dayKeyFmt.format(new Date());
  const lastDay = new Date(plan.weekEnd.getTime() - 86_400_000);

  return (
    <>
      <PageHeader
        title="Planning de la semaine"
        description={`Capacité nette = heures de travail des jours sans absence, moins ${EMERGENCY_RESERVE * 100} % réservés aux urgences (CDC §6.3).`}
        actions={
          <>
            <ButtonLink href={withParams("/planning", { week: prev, siteId: params.siteId })} variant="secondary" size="sm">
              ← Semaine précédente
            </ButtonLink>
            <ButtonLink href={withParams("/planning", { siteId: params.siteId })} variant="ghost" size="sm">
              Cette semaine
            </ButtonLink>
            <ButtonLink href={withParams("/planning", { week: next, siteId: params.siteId })} variant="secondary" size="sm">
              Semaine suivante →
            </ButtonLink>
          </>
        }
      />
      <Card className="mb-6">
        <form method="get" className="flex flex-wrap items-end gap-3 px-5 py-4">
          {params.week ? <input type="hidden" name="week" value={params.week} /> : null}
          <FilterField label="Site" htmlFor="siteId" className="w-56">
            <Select
              id="siteId"
              name="siteId"
              defaultValue={params.siteId ?? ""}
              placeholder="Tous les sites"
              options={sites.map((s) => ({ value: s.id, label: s.name }))}
            />
          </FilterField>
          <button type="submit" className="h-10 rounded-md px-3 text-sm ring-1 ring-slate-300 hover:bg-slate-50">
            Afficher
          </button>
          <p className="ml-auto text-sm text-slate-600">
            Semaine du {formatDay(plan.weekStart)} au {formatDay(lastDay)}
          </p>
        </form>
        {plan.rows.length === 0 ? (
          <EmptyState title="Aucun technicien" description="Aucun technicien actif dans ce périmètre." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px] table-fixed border-t border-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="sticky left-0 z-10 w-44 bg-slate-50 px-4 py-2.5">Technicien</th>
                  {plan.days.map((d) => (
                    <th
                      key={iso(d)}
                      className={cn("px-3 py-2.5", iso(d) === today && "bg-brand-50 text-brand-800", d.getUTCDay() % 6 === 0 && "text-slate-400")}
                    >
                      {formatDay(d)}
                    </th>
                  ))}
                  <th className="w-32 px-4 py-2.5 text-right">Charge</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {plan.rows.map((row) => {
                  const load = row.load ?? 0;
                  return (
                    <tr key={row.id} className="align-top">
                      <td className="sticky left-0 z-10 bg-white px-4 py-3">
                        <p className="font-medium text-slate-900">
                          {row.firstName} {row.lastName}
                        </p>
                        <p className="text-xs text-slate-500">{row.siteName}</p>
                      </td>
                      {plan.days.map((d) => {
                        const key = iso(d);
                        const dayEnd = new Date(d.getTime() + 86_399_000);
                        const absence = row.absences.find((a) => a.startAt <= dayEnd && a.endAt >= d);
                        const orders = row.orders.filter((o) => o.plannedStart && dayKeyFmt.format(o.plannedStart) === key);
                        return (
                          <td key={key} className={cn("px-2 py-2", key === today && "bg-brand-50/40", absence && "bg-slate-100")}>
                            {absence ? (
                              <p className="mb-1 rounded bg-slate-200 px-2 py-1 text-xs text-slate-700">
                                {ABSENCE_TYPE[absence.type] ?? "Absence"}
                                {absence.comment ? ` — ${absence.comment}` : ""}
                              </p>
                            ) : null}
                            <div className="space-y-1">
                              {orders.map((o) => (
                                <Link
                                  key={o.id}
                                  href={`/ordres-de-travail/${o.id}`}
                                  className={cn(
                                    "block rounded border px-2 py-1 text-xs hover:shadow-sm",
                                    o.priority === "P1"
                                      ? "border-red-200 bg-red-50"
                                      : o.status === "IN_PROGRESS"
                                        ? "border-violet-200 bg-violet-50"
                                        : "border-sky-200 bg-sky-50",
                                  )}
                                >
                                  <span className="font-medium">
                                    {o.plannedStart ? timeFmt.format(o.plannedStart) : ""} {o.equipmentCode}
                                  </span>
                                  <span className="block truncate text-slate-600">{o.title}</span>
                                  <span className="text-slate-500">{formatMinutes(o.estimatedMinutes ?? 120)}</span>
                                </Link>
                              ))}
                            </div>
                          </td>
                        );
                      })}
                      <td className="px-4 py-3 text-right">
                        <p
                          className={cn("font-semibold tabular-nums", load > 1 ? "text-red-700" : load > 0.85 ? "text-amber-700" : "text-slate-900")}
                        >
                          {row.load === null ? "—" : formatPercent(row.load)}
                        </p>
                        <p className="text-xs text-slate-500">
                          {formatNumber(row.plannedHours)} h / {formatNumber(row.capacityHours)} h
                        </p>
                        <div className="mt-1 h-1.5 w-24 overflow-hidden rounded-full bg-slate-100" aria-hidden>
                          <div
                            className={cn("h-full rounded-full", load > 1 ? "bg-red-500" : load > 0.85 ? "bg-amber-500" : "bg-brand-600")}
                            style={{ width: `${Math.min(load, 1) * 100}%` }}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card>
        <CardHeader title="À planifier" description={`OT créés ou en attente, par priorité — ${formatNumber(plan.backlogHours)} h estimées`} />
        {plan.backlog.length === 0 ? (
          <EmptyState title="Rien à planifier" />
        ) : (
          <Table>
            <THead>
              <tr>
                <TH>OT</TH>
                <TH>Équipement</TH>
                <TH>Priorité</TH>
                <TH>Durée estimée</TH>
                <TH>Statut</TH>
              </tr>
            </THead>
            <TBody>
              {plan.backlog.map((b) => (
                <TR key={b.id}>
                  <TD>
                    <Link href={`/ordres-de-travail/${b.id}`} className="font-medium text-brand-700 hover:underline">
                      {b.number}
                    </Link>
                    <p className="max-w-80 truncate text-xs text-slate-500">{b.title}</p>
                  </TD>
                  <TD>{b.equipmentCode}</TD>
                  <TD>
                    <PriorityBadge value={b.priority} />
                  </TD>
                  <TD>{b.estimatedMinutes ? formatMinutes(b.estimatedMinutes) : <Badge>non estimée</Badge>}</TD>
                  <TD>
                    <WorkOrderStatusBadge status={b.status} />
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
