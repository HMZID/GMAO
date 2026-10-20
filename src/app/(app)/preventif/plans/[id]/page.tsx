import Link from "next/link";
import { ActionForm, SubmitButton } from "@/components/forms/action-form";
import { PageHeader } from "@/components/layout/page-header";
import { EquipmentStatusBadge } from "@/components/status-badges";
import { Disclosure } from "@/components/ui/disclosure";
import { Badge, Card, CardBody, CardHeader, EmptyState } from "@/components/ui/primitives";
import { formatMinutes, formatNumber } from "@/lib/format";
import { CALENDAR_UNIT, METER_UNIT_SHORT, OPERATION_MODE } from "@/lib/labels";
import { getAuthContext } from "@/server/auth/session";
import { loadOr404 } from "@/server/pages";
import { getPlan } from "@/server/services/preventive";
import { addOperationAction } from "../../actions";
import { OperationFields } from "../../operation-fields";
import { T, Tr } from "@/i18n/client";
import { tpl } from "@/i18n/translate";

export const metadata = { title: "Plan d'entretien" };

type Plan = Awaited<ReturnType<typeof getPlan>>;

function triggerLabel(t: Plan["operations"][number]["triggers"][number]) {
  if (t.kind === "CALENDAR") {
    const unit = CALENDAR_UNIT[t.calendarUnit ?? "MONTH"];
    return `${formatNumber(t.every)} ${t.every > 1 ? unit.many : unit.one}`;
  }
  return formatNumber(t.every, METER_UNIT_SHORT[t.meterType ?? "HOURS"]);
}

export default async function PlanPage(props: PageProps<"/preventif/plans/[id]">) {
  const { id } = await props.params;
  const ctx = await getAuthContext();
  const plan = await loadOr404(id, (x) => getPlan(ctx, x));

  return (
    <>
      <PageHeader
        back={{ href: "/preventif", label: "Préventif" }}
        title={plan.name}
        description={plan.description ?? undefined}
        meta={
          <>
            <Badge tone="teal">
              <T params={{ version: plan.version }}>{"Version {version}"}</T>
            </Badge>
            {plan.category ? (
              <Badge>
                <T params={{ name: plan.category.name }}>{"Catégorie : {name}"}</T>
              </Badge>
            ) : null}
            {plan.model ? (
              <Badge>
                <T params={{ manufacturer: plan.model.manufacturer, name: plan.model.name }}>{"Modèle : {manufacturer} {name}"}</T>
              </Badge>
            ) : null}
            {!plan.active ? (
              <Badge tone="amber">
                <T>Inactif</T>
              </Badge>
            ) : null}
          </>
        }
      />
      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-4 xl:col-span-2">
          {plan.operations.map((op) => (
            <Card key={op.id}>
              <CardHeader
                title={
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-sm text-slate-500">
                      <Tr>{op.code}</Tr>
                    </span>{" "}
                    <Tr>{op.name}</Tr>
                  </span>
                }
                description={tpl`Tous les ${op.triggers.map(triggerLabel).join(" ou ")} — au premier seuil atteint`}
                actions={
                  <>
                    <Badge tone="blue">
                      <Tr>{OPERATION_MODE[op.mode]}</Tr>
                    </Badge>
                    {op.isRegulatory ? (
                      <Badge tone="violet">
                        <T>Réglementaire</T>
                      </Badge>
                    ) : null}
                    {op.blockWhenOverdue ? (
                      <Badge tone="red">
                        <T>Bloquant si échu</T>
                      </Badge>
                    ) : null}
                  </>
                }
              />
              <CardBody className="space-y-3 text-sm">
                <p className="text-slate-600">
                  <T
                    params={{
                      v:
                        [op.preAlertDays != null ? `${op.preAlertDays} j` : null, op.preAlertMeter != null ? formatNumber(op.preAlertMeter) : null]
                          .filter(Boolean)
                          .join(" ou ") || "—",
                      v2: op.tolerancePercent ?? 10,
                      v3: op.estimatedMinutes ? formatMinutes(op.estimatedMinutes) : "—",
                    }}
                  >
                    {"Pré-alerte : {v} · Tolérance : {v2} % · Durée estimée : {v3}"}
                  </T>
                </p>
                {op.taskList?.items.length ? (
                  <ol className="list-decimal space-y-0.5 ps-5 text-slate-800">
                    {op.taskList.items.map((item) => (
                      <li key={item.id}>
                        <Tr>{item.label}</Tr> {item.required ? <span className="text-red-600">*</span> : null}
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="text-slate-400">
                    <T>Pas de checklist.</T>
                  </p>
                )}
              </CardBody>
            </Card>
          ))}
          {plan.operations.length === 0 ? (
            <Card>
              <EmptyState title="Aucune opération" />
            </Card>
          ) : null}
          {ctx.can("plan.write") ? (
            <Disclosure summary="Ajouter une opération (nouvelle version du plan)">
              <ActionForm action={addOperationAction.bind(null, plan.id)} resetOnSuccess className="space-y-4">
                <p className="text-sm text-slate-600">
                  <T>Les interventions déjà générées ne changent pas ; une échéance est créée pour chaque équipement auquel le plan est appliqué.</T>
                </p>
                <OperationFields />
                <SubmitButton>
                  <T>Ajouter l&apos;opération</T>
                </SubmitButton>
              </ActionForm>
            </Disclosure>
          ) : null}
        </div>
        <Card>
          <CardHeader title="Équipements" description="Auxquels le plan est appliqué (dans votre périmètre)" />
          {plan.equipment.length === 0 ? (
            <EmptyState title="Aucun équipement" description="Appliquer le plan depuis la fiche d'un équipement." />
          ) : (
            <ul className="divide-y divide-slate-100 text-sm">
              {plan.equipment.map((e) => (
                <li key={e.id} className="flex items-center justify-between gap-2 px-5 py-2.5">
                  <span>
                    <Link href={`/equipements/${e.id}`} className="font-medium text-brand-700 hover:underline">
                      <Tr>{e.code}</Tr>
                    </Link>{" "}
                    <span className="text-slate-600">
                      <Tr>{e.name}</Tr>
                    </span>
                    {!e.active ? (
                      <Badge className="ms-2">
                        <T>Suspendu</T>
                      </Badge>
                    ) : null}
                  </span>
                  <EquipmentStatusBadge status={e.status} />
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
