import Link from "next/link";
import { DueStatusBadge, PriorityBadge, WorkOrderStatusBadge } from "@/components/status-badges";
import { PageHeader } from "@/components/layout/page-header";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardHeader, EmptyState, StatTile, Table, TBody, TD, TH, THead, TR } from "@/components/ui/primitives";
import { formatCurrency, formatDate, formatNumber } from "@/lib/format";
import { getAuthContext } from "@/server/auth/session";
import { getDashboard } from "@/server/services/kpi";
import { listDueItems } from "@/server/services/preventive";
import { listWorkOrders } from "@/server/services/work-orders";

export const metadata = { title: "Tableau de bord" };

export default async function DashboardPage() {
  const ctx = await getAuthContext();
  const [dashboard, urgent, dues] = await Promise.all([
    getDashboard(ctx),
    ctx.can("workorder.read") ? listWorkOrders(ctx, { status: "OPEN", pageSize: 8 }) : null,
    ctx.can("plan.read") ? listDueItems(ctx, { status: "OPEN" }) : null,
  ]);
  const eq = dashboard.equipmentByStatus;
  const wo = dashboard.workOrders;
  const due = dashboard.dueItems;
  const actionable = dues?.filter((d) => d.status !== "UPCOMING").slice(0, 8) ?? [];

  return (
    <>
      <PageHeader
        title={`Bonjour ${ctx.name.split(" ")[0]}`}
        description="Situation du parc et de la maintenance dans votre périmètre."
        actions={
          <>
            {ctx.can("request.create") ? <ButtonLink href="/demandes/nouvelle">Signaler une panne</ButtonLink> : null}
            {ctx.can("workorder.create") ? (
              <ButtonLink href="/ordres-de-travail/nouveau" variant="secondary">
                Nouvel OT
              </ButtonLink>
            ) : null}
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="Immobilisés"
          value={eq.IMMOBILIZED ?? 0}
          tone="red"
          href="/equipements?status=IMMOBILIZED"
          hint="Équipements inaptes à l'exploitation"
        />
        <StatTile label="En maintenance" value={eq.IN_MAINTENANCE ?? 0} tone="amber" href="/equipements?status=IN_MAINTENANCE" />
        <StatTile label="Disponibles ou en service" value={(eq.AVAILABLE ?? 0) + (eq.IN_SERVICE ?? 0)} tone="green" href="/equipements" />
        <StatTile label="DI à qualifier" value={dashboard.requestsToQualify} tone="blue" href="/demandes?status=NEW" />
        <StatTile
          label="OT ouverts"
          value={Object.values(wo.byStatus).reduce((a, b) => a + b, 0)}
          tone="violet"
          href="/ordres-de-travail"
          hint={`${wo.byPriority.P1 ?? 0} urgence(s) P1 · ${wo.byStatus.ON_HOLD ?? 0} en attente`}
        />
        <StatTile
          label="Échéances en retard"
          value={due.OVERDUE ?? 0}
          tone="red"
          href="/preventif/echeances?status=OVERDUE"
          hint={`${due.DUE ?? 0} échue(s), ${due.PRE_ALERT ?? 0} en pré-alerte`}
        />
        <StatTile label="Articles sous le seuil" value={dashboard.belowReorder} tone="amber" href="/stock?belowReorder=1" />
        <StatTile
          label="Coût de maintenance du mois"
          value={dashboard.monthCosts ? formatCurrency(dashboard.monthCosts.total) : "—"}
          tone="teal"
          href={ctx.can("kpi.read") ? "/indicateurs" : undefined}
          hint={
            dashboard.monthCosts
              ? `MO ${formatCurrency(dashboard.monthCosts.labor)} · pièces ${formatCurrency(dashboard.monthCosts.parts)}`
              : undefined
          }
        />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        {urgent ? (
          <Card>
            <CardHeader
              title="Ordres de travail ouverts"
              description="Par priorité puis date prévue"
              actions={
                <Link href="/ordres-de-travail" className="text-sm text-brand-700 hover:underline">
                  Tout voir
                </Link>
              }
            />
            {urgent.items.length === 0 ? (
              <EmptyState title="Aucun OT ouvert" />
            ) : (
              <Table>
                <THead>
                  <tr>
                    <TH>OT</TH>
                    <TH>Équipement</TH>
                    <TH>Priorité</TH>
                    <TH>Statut</TH>
                  </tr>
                </THead>
                <TBody>
                  {urgent.items.map((w) => (
                    <TR key={w.id}>
                      <TD>
                        <Link href={`/ordres-de-travail/${w.id}`} className="font-medium text-brand-700 hover:underline">
                          {w.number}
                        </Link>
                        <p className="max-w-56 truncate text-xs text-slate-500">{w.title}</p>
                      </TD>
                      <TD>{w.equipmentCode}</TD>
                      <TD>
                        <PriorityBadge value={w.priority} short />
                      </TD>
                      <TD>
                        <WorkOrderStatusBadge status={w.status} />
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            )}
          </Card>
        ) : null}

        {dues ? (
          <Card>
            <CardHeader
              title="Échéances préventives à traiter"
              description="En retard, échues ou en pré-alerte"
              actions={
                <Link href="/preventif/echeances" className="text-sm text-brand-700 hover:underline">
                  Tout voir
                </Link>
              }
            />
            {actionable.length === 0 ? (
              <EmptyState title="Aucune échéance à traiter" description="Les échéances à venir apparaissent dans le module Préventif." />
            ) : (
              <Table>
                <THead>
                  <tr>
                    <TH>Équipement</TH>
                    <TH>Opération</TH>
                    <TH>Échéance</TH>
                    <TH>Statut</TH>
                  </tr>
                </THead>
                <TBody>
                  {actionable.map((d) => (
                    <TR key={d.id}>
                      <TD>
                        <Link href={`/equipements/${d.equipmentId}`} className="font-medium text-brand-700 hover:underline">
                          {d.equipmentCode}
                        </Link>
                      </TD>
                      <TD>{d.operationName}</TD>
                      <TD className="whitespace-nowrap">
                        {d.dueMeterValue !== null ? `${formatNumber(d.dueMeterValue, d.meterUnit ?? "")}` : null}
                        {d.dueMeterValue !== null && d.dueDate ? " ou " : null}
                        {d.dueDate ? formatDate(d.dueDate) : null}
                      </TD>
                      <TD>
                        <DueStatusBadge status={d.status} />
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            )}
          </Card>
        ) : null}
      </div>
    </>
  );
}
