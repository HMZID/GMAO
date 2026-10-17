import { FilterBar, FilterField } from "@/components/filter-bar";
import { DeadlinesTable } from "@/components/fleet/deadlines-table";
import { Forbidden } from "@/components/forbidden";
import { PageHeader } from "@/components/layout/page-header";
import { Select } from "@/components/ui/inputs";
import { Card } from "@/components/ui/primitives";
import { DEADLINE_KIND, options } from "@/lib/labels";
import { getAuthContext } from "@/server/auth/session";
import { cleanFilters, queryParams } from "@/server/pages";
import { deadlineFilters, listDeadlines } from "@/server/services/fleet-deadlines";

export const metadata = { title: "Échéances du parc" };

const HORIZONS = {
  open: "Toutes les échéances en cours",
  "30": "En retard ou dans les 30 jours",
  overdue: "En retard",
  history: "Historique compris",
};

export default async function FleetDeadlinesPage(props: PageProps<"/equipements/echeances">) {
  const ctx = await getAuthContext();
  if (!ctx.can("equipment.read")) return <Forbidden what="les échéances du parc" />;
  const params = cleanFilters(deadlineFilters, queryParams(await props.searchParams));
  const now = new Date();
  const items = await listDeadlines(ctx, params, now);

  return (
    <>
      <PageHeader
        back={{ href: "/equipements", label: "Équipements" }}
        title="Échéances du parc"
        description="Assurances, visites techniques et vignettes de tout le parc, de la plus proche à la plus lointaine. Le responsable du parc est alerté à J−30, J−7, le jour même puis chaque semaine de retard."
      />
      <Card>
        <FilterBar resetHref="/equipements/echeances">
          <FilterField label="Type" htmlFor="kind">
            <Select id="kind" name="kind" defaultValue={params.kind ?? ""} placeholder="Tous" options={options(DEADLINE_KIND)} />
          </FilterField>
          <FilterField label="Horizon" htmlFor="horizon" className="w-72">
            <Select id="horizon" name="horizon" defaultValue={params.horizon ?? "open"} options={options(HORIZONS)} />
          </FilterField>
        </FilterBar>
        <DeadlinesTable items={items} ctx={ctx} now={now} showEquipment emptyText="Aucune échéance pour ces filtres." />
      </Card>
    </>
  );
}
