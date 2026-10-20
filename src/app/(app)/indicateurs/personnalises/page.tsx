import { Forbidden } from "@/components/forbidden";
import { ActionForm, SubmitButton } from "@/components/forms/action-form";
import { PageHeader } from "@/components/layout/page-header";
import { Disclosure } from "@/components/ui/disclosure";
import { Card, CardBody, CardHeader, EmptyState } from "@/components/ui/primitives";
import { formatNumber } from "@/lib/format";
import { getAuthContext } from "@/server/auth/session";
import { INDICATOR_DEFINITIONS, INDICATOR_SOURCES } from "@/server/domain/indicators";
import { listIndicators, type IndicatorResult } from "@/server/services/indicators";
import { deleteIndicatorAction } from "../actions";
import { IndicatorForm, type SourceOption } from "./indicator-form";
import { T } from "@/i18n/client";

export const metadata = { title: "Indicateurs personnalisés" };

/** Sources proposées au formulaire : listes simples, sérialisables pour le composant client. */
function sourceOptions(): SourceOption[] {
  return INDICATOR_SOURCES.map((key) => {
    const def = INDICATOR_DEFINITIONS[key];
    return {
      value: key,
      label: def.label,
      fields: def.fields.map((f) => ({ value: f.key, label: f.unit ? `${f.label} (${f.unit})` : f.label })),
      dimensions: def.dimensions.map((d) => ({
        value: d.key,
        label: d.label,
        choices: d.choices ? Object.entries(d.choices).map(([value, v]) => ({ value, label: typeof v === "string" ? v : v.label })) : null,
      })),
    };
  });
}

/** Indicateurs composés par l'organisation (KPI-11) : valeur, barres ou tableau, dans le périmètre de chacun. */
export default async function CustomIndicatorsPage() {
  const ctx = await getAuthContext();
  if (!ctx.can("kpi.read")) return <Forbidden what="les indicateurs" />;
  const indicators = await listIndicators(ctx);
  const canManage = ctx.can("indicator.manage");

  return (
    <>
      <PageHeader
        back={{ href: "/indicateurs", label: "Indicateurs" }}
        title="Indicateurs personnalisés"
        description="Indicateurs composés par votre organisation à partir de ses données : chacun ne voit que les valeurs de son périmètre."
      />
      {canManage ? (
        <Disclosure summary="Nouvel indicateur" className="mb-6">
          <IndicatorForm sources={sourceOptions()} />
        </Disclosure>
      ) : null}
      {indicators.length === 0 ? (
        <Card>
          <EmptyState
            title="Aucun indicateur personnalisé"
            description={
              canManage
                ? "Composer un premier indicateur : par exemple le nombre d'interventions par statut, ou les heures de main-d'œuvre par technicien."
                : "Votre organisation n'a pas encore composé d'indicateur."
            }
          />
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {indicators.map((indicator) => (
            <Card key={indicator.id} className="flex flex-col">
              <CardHeader
                title={indicator.name}
                description={indicator.description}
                actions={
                  canManage ? (
                    <ActionForm action={deleteIndicatorAction.bind(null, indicator.id)} showMessage={false}>
                      <SubmitButton size="sm" variant="ghost">
                        <T>Supprimer</T>
                      </SubmitButton>
                    </ActionForm>
                  ) : null
                }
              />
              <CardBody className="flex-1">
                {indicator.result ? (
                  <IndicatorView chart={indicator.chart} result={indicator.result} />
                ) : (
                  <p className="text-sm text-slate-500">
                    <T>Données non accessibles avec votre profil.</T>
                  </p>
                )}
              </CardBody>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}

function IndicatorView({ chart, result }: { chart: string; result: IndicatorResult }) {
  const value = (n: number) => `${formatNumber(n)}${result.unit ? ` ${result.unit}` : ""}`;
  if (chart === "number" || result.groups.length === 0) {
    return <p className="text-3xl font-semibold tabular-nums text-slate-900">{value(result.value)}</p>;
  }
  if (chart === "table") {
    return (
      <table className="w-full text-sm">
        <tbody className="divide-y divide-slate-100">
          {result.groups.map((g) => (
            <tr key={g.key ?? "vide"}>
              <td className="py-1.5 pe-3 text-slate-700">{g.label}</td>
              <td className="py-1.5 text-end font-medium tabular-nums">{value(g.value)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t border-slate-200 font-semibold">
            <td className="py-1.5">
              <T>Ensemble</T>
            </td>
            <td className="py-1.5 text-end tabular-nums">{value(result.value)}</td>
          </tr>
        </tfoot>
      </table>
    );
  }
  const max = Math.max(...result.groups.map((g) => g.value), 0);
  return (
    <ul className="space-y-2" aria-label="Valeurs par regroupement">
      {result.groups.map((g) => (
        <li key={g.key ?? "vide"} className="grid grid-cols-[minmax(0,10rem)_1fr_auto] items-center gap-3 text-sm">
          <span className="truncate text-slate-700" title={g.label}>
            {g.label}
          </span>
          <span className="h-3 rounded-sm bg-slate-100" aria-hidden>
            <span
              className="block h-full rounded-e bg-brand-600"
              style={{ width: `${max > 0 ? Math.max((g.value / max) * 100, g.value > 0 ? 2 : 0) : 0}%` }}
            />
          </span>
          <span className="font-medium tabular-nums text-slate-900">{value(g.value)}</span>
        </li>
      ))}
    </ul>
  );
}
