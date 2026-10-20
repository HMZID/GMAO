import { ArrowDown, ArrowUp } from "lucide-react";
import { Forbidden } from "@/components/forbidden";
import { ActionForm, Field, SubmitButton } from "@/components/forms/action-form";
import { PageHeader } from "@/components/layout/page-header";
import { Disclosure } from "@/components/ui/disclosure";
import { Checkbox, Input, Textarea } from "@/components/ui/inputs";
import { Alert, Badge, Card, EmptyState } from "@/components/ui/primitives";
import { formatNumber } from "@/lib/format";
import { getAuthContext } from "@/server/auth/session";
import { planFeatures } from "@/server/domain/site";
import { isPlatformAdmin } from "@/server/services/platform";
import { listSitePlans } from "@/server/services/site";
import { createSitePlanAction, deleteSitePlanAction, moveSitePlanAction, updateSitePlanAction } from "../actions";
import { SiteAdminNav } from "../site-admin-nav";
import { T, Tr } from "@/i18n/client";
import { tpl } from "@/i18n/translate";

export const metadata = { title: "Offres et tarifs" };

type Plan = Awaited<ReturnType<typeof listSitePlans>>[number];

function PlanFields({ plan }: { plan?: Plan }) {
  return (
    <>
      <Field label="Nom de l'offre" name="name" required>
        <Input name="name" required maxLength={60} defaultValue={plan?.name} />
      </Field>
      <Field label="Badge" name="badge" hint="Ex. : Le plus choisi">
        <Input name="badge" maxLength={40} defaultValue={plan?.badge ?? ""} />
      </Field>
      <Field label="Accroche" name="tagline" className="md:col-span-2">
        <Input name="tagline" maxLength={200} defaultValue={plan?.tagline ?? ""} />
      </Field>
      <Field label="Prix mensuel (HT, devise du site)" name="priceMonthly" hint="Vide : « sur devis » (le libellé du prix s'affiche à la place)">
        <Input name="priceMonthly" inputMode="decimal" defaultValue={plan?.priceMonthly ?? ""} />
      </Field>
      <Field label="Libellé du prix" name="priceUnit" hint="Ex. : DT HT / équipement / mois, ou « Sur devis »">
        <Input name="priceUnit" maxLength={80} defaultValue={plan?.priceUnit ?? ""} />
      </Field>
      <Field label="Condition" name="priceNote" hint="Ex. : À partir de 10 équipements">
        <Input name="priceNote" maxLength={160} defaultValue={plan?.priceNote ?? ""} />
      </Field>
      <Field label="Bouton" name="ctaLabel" hint="Ex. : Essayer l'offre Flotte">
        <Input name="ctaLabel" maxLength={60} defaultValue={plan?.ctaLabel ?? ""} />
      </Field>
      <Field label="Avantages (un par ligne)" name="features" className="md:col-span-2">
        <Textarea name="features" rows={6} maxLength={3000} defaultValue={plan?.features ?? ""} />
      </Field>
      <div className="flex flex-wrap gap-6 md:col-span-2">
        <Checkbox name="highlighted" label="Mise en avant (carte sombre)" defaultChecked={plan?.highlighted ?? false} />
        <Checkbox name="published" label="Publiée sur le site" defaultChecked={plan ? plan.published : true} />
      </div>
    </>
  );
}

/** Offres affichées sur l'accueil et la page des tarifs ; l'avantage du paiement annuel se règle dans « Textes et réglages ». */
export default async function SitePlansPage() {
  const ctx = await getAuthContext();
  if (!isPlatformAdmin(ctx)) return <Forbidden what="l'administration du site" />;
  const plans = await listSitePlans(ctx);

  return (
    <>
      <PageHeader
        back={{ href: "/administration", label: "Administration" }}
        title="Site commercial"
        description="Offres et tarifs publiés sur le site."
      />
      <SiteAdminNav active="tarifs" />
      <div className="mb-6">
        <Alert tone="blue">
          <T>
            Les prix sont affichés hors taxes. La remise du paiement annuel (mois facturés sur 12) et son libellé se règlent dans « Textes et réglages
            », rubrique « Essai et tarifs ».
          </T>
        </Alert>
      </div>
      <Disclosure summary="Ajouter une offre" className="mb-6">
        <ActionForm action={createSitePlanAction} resetOnSuccess className="grid gap-4 md:grid-cols-2">
          <PlanFields />
          <div className="md:col-span-2">
            <SubmitButton>
              <T>Ajouter</T>
            </SubmitButton>
          </div>
        </ActionForm>
      </Disclosure>
      {plans.length === 0 ? (
        <Card>
          <EmptyState title="Aucune offre" description="La rubrique des tarifs est masquée tant qu'aucune offre n'est publiée." />
        </Card>
      ) : (
        <ol className="space-y-3">
          {plans.map((plan, i) => (
            <li key={plan.id}>
              <Card className="p-4">
                <div className="flex flex-wrap items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-slate-900">
                      {plan.name}
                      <span className="ms-2 text-sm font-normal text-slate-500">
                        <Tr>
                          {plan.priceMonthly === null ? plan.priceUnit || "Sur devis" : `${formatNumber(plan.priceMonthly)} ${plan.priceUnit ?? ""}`}
                        </Tr>
                      </span>
                      {plan.highlighted ? (
                        <Badge tone="amber" className="ms-2">
                          <T>Mise en avant</T>
                        </Badge>
                      ) : null}
                      {!plan.published ? (
                        <Badge tone="gray" className="ms-2">
                          <T>Non publiée</T>
                        </Badge>
                      ) : null}
                    </p>
                    <p className="mt-1 text-sm text-slate-600">{planFeatures(plan.features).join(" · ")}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <ActionForm action={moveSitePlanAction.bind(null, plan.id, "up")} showMessage={false}>
                      <button
                        type="submit"
                        disabled={i === 0}
                        className="rounded-md p-2 text-slate-600 hover:bg-slate-100 disabled:opacity-30"
                        aria-label={tpl`Monter « ${plan.name} »`}
                      >
                        <ArrowUp className="h-4 w-4" aria-hidden />
                      </button>
                    </ActionForm>
                    <ActionForm action={moveSitePlanAction.bind(null, plan.id, "down")} showMessage={false}>
                      <button
                        type="submit"
                        disabled={i === plans.length - 1}
                        className="rounded-md p-2 text-slate-600 hover:bg-slate-100 disabled:opacity-30"
                        aria-label={tpl`Descendre « ${plan.name} »`}
                      >
                        <ArrowDown className="h-4 w-4" aria-hidden />
                      </button>
                    </ActionForm>
                  </div>
                </div>
                <Disclosure summary="Modifier" className="mt-3">
                  <ActionForm action={updateSitePlanAction.bind(null, plan.id)} className="grid gap-4 md:grid-cols-2">
                    <PlanFields plan={plan} />
                    <div className="md:col-span-2">
                      <SubmitButton>
                        <T>Enregistrer</T>
                      </SubmitButton>
                    </div>
                  </ActionForm>
                  <ActionForm action={deleteSitePlanAction.bind(null, plan.id)} className="mt-4 border-t border-slate-100 pt-4">
                    <SubmitButton variant="danger" size="sm" pendingLabel="Suppression…">
                      <T>Supprimer l&apos;offre</T>
                    </SubmitButton>
                  </ActionForm>
                </Disclosure>
              </Card>
            </li>
          ))}
        </ol>
      )}
    </>
  );
}
