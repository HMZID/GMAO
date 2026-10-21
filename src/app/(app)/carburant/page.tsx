import Link from "next/link";
import { FilterBar, FilterField } from "@/components/filter-bar";
import { Forbidden } from "@/components/forbidden";
import { FuelEntriesTable } from "@/components/fuel/fuel-entries-table";
import { FuelEntryForm } from "@/components/fuel/fuel-entry-form";
import { PageHeader } from "@/components/layout/page-header";
import { buttonClass } from "@/components/ui/button";
import { Disclosure } from "@/components/ui/disclosure";
import { Input } from "@/components/ui/inputs";
import { Badge, Card, CardHeader, EmptyState, StatTile, Table, TBody, TD, TH, THead, TR } from "@/components/ui/primitives";
import { formatCurrency, formatDate, formatNumber, toDateInput } from "@/lib/format";
import { getAuthContext } from "@/server/auth/session";
import { cleanFilters, queryParams } from "@/server/pages";
import { consumptionFilters, fuelConsumption, listFuelCardOptions, listFuelEntries, listFuelEquipmentOptions } from "@/server/services/fuel";
import { T, Tr } from "@/i18n/client";
import { tpl } from "@/i18n/translate";

export const metadata = { title: "Carburant" };

export default async function FuelPage(props: PageProps<"/carburant">) {
  const ctx = await getAuthContext();
  if (!ctx.can("fuel.read")) return <Forbidden what="le suivi du carburant" />;
  const params = cleanFilters(consumptionFilters, queryParams(await props.searchParams));
  const now = new Date();
  const [consumption, toReview, recent, equipmentOptions, cards] = await Promise.all([
    fuelConsumption(ctx, params, now),
    listFuelEntries(ctx, { review: "TO_REVIEW", pageSize: 50 }),
    listFuelEntries(ctx, { ...params, pageSize: 30 }),
    listFuelEquipmentOptions(ctx),
    listFuelCardOptions(ctx),
  ]);
  const canWrite = ctx.can("fuel.write");

  return (
    <>
      <PageHeader
        title="Carburant et fluides"
        description="Pleins et appoints, consommation de chaque engin (L/h) ou véhicule (L/100 km) calculée de plein complet à plein complet, anomalies à examiner."
        actions={
          <>
            <Link href="/carburant/cartes" className={buttonClass("secondary")}>
              <T>Cartes carburant</T>
            </Link>
            {ctx.can("fuel.manage") ? (
              <Link href="/imports" className={buttonClass("secondary")}>
                <T>Importer un relevé de carte</T>
              </Link>
            ) : null}
          </>
        }
      />

      {canWrite ? (
        <Disclosure summary="Saisir un plein" className="mb-6">
          <FuelEntryForm equipmentOptions={equipmentOptions} cards={cards} now={now} />
        </Disclosure>
      ) : null}

      <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatTile
          label="Carburant consommé"
          value={formatNumber(consumption.totals.litres, "L")}
          tone="teal"
          hint={tpl`Du ${formatDate(consumption.from)} au ${formatDate(consumption.to)}`}
        />
        <StatTile label="Montant des pleins" value={formatCurrency(consumption.totals.amount)} tone="blue" hint="Carburant et autres fluides" />
        <StatTile label="Équipements suivis" value={consumption.items.length} tone="gray" />
        <StatTile
          label="Pleins à examiner"
          value={toReview.total}
          tone={toReview.total > 0 ? "amber" : "green"}
          hint="Anomalies détectées à la saisie"
        />
      </div>

      <Card className="mb-6">
        <CardHeader
          title="Consommation par équipement"
          description="Plein à plein ; référence : celle de l'équipement, sinon la médiane de ses pleins précédents. Écart signalé au-delà de 25 %."
        />
        <FilterBar resetHref="/carburant">
          <FilterField label="Du" htmlFor="from">
            <Input id="from" name="from" type="date" defaultValue={params.from ?? toDateInput(consumption.from)} />
          </FilterField>
          <FilterField label="Au" htmlFor="to">
            <Input id="to" name="to" type="date" defaultValue={params.to ?? toDateInput(consumption.to)} />
          </FilterField>
        </FilterBar>
        {consumption.items.length === 0 ? (
          <EmptyState title="Aucun plein sur la période" description="Saisir un plein ou importer un relevé de carte carburant." />
        ) : (
          <Table>
            <THead>
              <tr>
                <TH>
                  <T>Équipement</T>
                </TH>
                <TH className="text-end">
                  <T>Carburant</T>
                </TH>
                <TH className="text-end">
                  <T>Montant</T>
                </TH>
                <TH className="text-end">
                  <T>Usage</T>
                </TH>
                <TH className="text-end">
                  <T>Consommation</T>
                </TH>
                <TH className="text-end">
                  <T>Référence</T>
                </TH>
                <TH>
                  <T>Écart</T>
                </TH>
              </tr>
            </THead>
            <TBody>
              {consumption.items.map((i) => (
                <TR key={i.equipmentId}>
                  <TD>
                    <Link href={`/equipements/${i.equipmentId}`} className="font-medium text-brand-700 hover:underline">
                      {i.code}
                    </Link>
                    <p className="max-w-56 truncate text-xs text-slate-500">
                      {i.name} · {i.siteName}
                    </p>
                  </TD>
                  <TD className="text-end tabular-nums">
                    {formatNumber(i.fuelLitres, "L")}
                    {i.otherLitres > 0 ? (
                      <p className="text-xs text-slate-500">
                        <T params={{ litres: formatNumber(i.otherLitres, "L") }}>{"+ {litres} d'autres fluides"}</T>
                      </p>
                    ) : null}
                  </TD>
                  <TD className="text-end tabular-nums">{formatCurrency(i.amount)}</TD>
                  <TD className="text-end tabular-nums">{i.usage > 0 ? formatNumber(i.usage, i.unit === "L/h" ? "h" : "km") : "—"}</TD>
                  <TD className="text-end font-medium tabular-nums">{i.rate !== null ? formatNumber(i.rate, i.unit ?? "") : "—"}</TD>
                  <TD className="text-end tabular-nums">{i.reference !== null ? formatNumber(i.reference, i.unit ?? "") : "—"}</TD>
                  <TD>
                    {i.deviation === null ? (
                      <span className="text-xs text-slate-400">
                        <T>Non calculable</T>
                      </span>
                    ) : (
                      <Badge tone={Math.abs(i.deviation) > 25 ? "red" : Math.abs(i.deviation) > 10 ? "amber" : "green"}>
                        {i.deviation > 0 ? "+" : ""}
                        {formatNumber(i.deviation)} %
                      </Badge>
                    )}
                    {i.toReview > 0 ? (
                      <p className="mt-1 text-xs text-amber-700">
                        <T params={{ n: i.toReview }}>{"{n} plein(s) à examiner"}</T>
                      </p>
                    ) : null}
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </Card>

      {toReview.total > 0 ? (
        <Card className="mb-6">
          <CardHeader
            title="Pleins à examiner"
            description="Anomalie justifiée : le plein reste dans les calculs. Plein erroné : il est annulé et sort des calculs (conservé dans l'historique)."
          />
          <FuelEntriesTable items={toReview.items} ctx={ctx} showEquipment />
        </Card>
      ) : null}

      <Card>
        <CardHeader
          title="Derniers pleins"
          description={tpl`${recent.total} plein(s) sur la période`}
          actions={
            <span className="text-xs text-slate-500">
              <Tr>{"30 plus récents"}</Tr>
            </span>
          }
        />
        <FuelEntriesTable items={recent.items} ctx={ctx} showEquipment emptyText="Aucun plein sur la période." />
      </Card>
    </>
  );
}
