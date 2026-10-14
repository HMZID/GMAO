import Link from "next/link";
import { Forbidden } from "@/components/forbidden";
import { PageHeader } from "@/components/layout/page-header";
import { Badge, Card, EmptyState, StatTile, Table, TBody, TD, TH, THead, TR } from "@/components/ui/primitives";
import { formatDateTime } from "@/lib/format";
import { DEMO_REQUEST_STATUS } from "@/lib/labels";
import { getAuthContext } from "@/server/auth/session";
import { FLEET_SIZES } from "@/server/domain/site";
import { cleanFilters, queryParams } from "@/server/pages";
import { demoRequestFilters, listDemoRequests } from "@/server/services/demo-requests";
import { isPlatformAdmin } from "@/server/services/platform";
import { SiteAdminNav } from "../site-admin-nav";

export const metadata = { title: "Demandes de démonstration" };

const FLEET = Object.fromEntries(FLEET_SIZES.map((f) => [f.value, f.label]));

/** Demandes de compte de démonstration déposées sur le site : à accepter ou refuser. */
export default async function DemoRequestsPage(props: PageProps<"/administration/site/demandes">) {
  const ctx = await getAuthContext();
  if (!isPlatformAdmin(ctx)) return <Forbidden what="l'administration du site" />;
  const params = cleanFilters(demoRequestFilters, queryParams(await props.searchParams));
  const { items, stats } = await listDemoRequests(ctx, params);
  const filter = (status?: string) => (status ? `/administration/site/demandes?status=${status}` : "/administration/site/demandes");

  return (
    <>
      <PageHeader
        back={{ href: "/administration", label: "Administration" }}
        title="Site commercial"
        description="Demandes de démonstration, textes, blocs, offres et pages du site public. Toute modification est visible aussitôt sur le site."
      />
      <SiteAdminNav active="demandes" pending={stats.PENDING} />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatTile label="En attente" value={stats.PENDING ?? 0} tone={stats.PENDING ? "amber" : "gray"} href={filter("PENDING")} />
        <StatTile label="Acceptées" value={stats.APPROVED ?? 0} tone="green" href={filter("APPROVED")} />
        <StatTile label="Refusées" value={stats.REJECTED ?? 0} href={filter("REJECTED")} />
      </div>

      <Card>
        <div className="flex items-center justify-between px-5 py-3 text-sm">
          <span className="text-slate-600">{params.status ? `Filtre : ${DEMO_REQUEST_STATUS[params.status]?.label}` : "Toutes les demandes"}</span>
          {params.status ? (
            <Link href={filter()} className="text-brand-700 hover:underline">
              Tous les statuts
            </Link>
          ) : null}
        </div>
        {items.length === 0 ? (
          <EmptyState title="Aucune demande" description="Les demandes déposées sur la page « Essai gratuit » du site apparaissent ici." />
        ) : (
          <Table>
            <THead>
              <tr>
                <TH>Société</TH>
                <TH>Contact</TH>
                <TH>Parc</TH>
                <TH>Reçue le</TH>
                <TH>Statut</TH>
              </tr>
            </THead>
            <TBody>
              {items.map((r) => (
                <TR key={r.id}>
                  <TD>
                    <Link href={`/administration/site/demandes/${r.id}`} className="font-medium text-brand-700 hover:underline">
                      {r.company}
                    </Link>
                    {r.sector ? <p className="text-xs text-slate-500">{r.sector}</p> : null}
                  </TD>
                  <TD>
                    <p>{r.contactName}</p>
                    <p className="text-xs text-slate-500">{r.email}</p>
                    {r.existingAccount && r.status === "PENDING" ? (
                      <Badge tone="red" className="mt-1">
                        Compte existant
                      </Badge>
                    ) : null}
                  </TD>
                  <TD className="text-sm">{r.fleetSize ? FLEET[r.fleetSize] : "—"}</TD>
                  <TD className="text-xs">{formatDateTime(r.createdAt)}</TD>
                  <TD>
                    <Badge tone={DEMO_REQUEST_STATUS[r.status]?.tone ?? "gray"}>{DEMO_REQUEST_STATUS[r.status]?.label ?? r.status}</Badge>
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
