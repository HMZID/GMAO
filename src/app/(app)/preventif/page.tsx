import Link from "next/link";
import { Forbidden } from "@/components/forbidden";
import { ActionForm, SubmitButton } from "@/components/forms/action-form";
import { PageHeader } from "@/components/layout/page-header";
import { ButtonLink } from "@/components/ui/button";
import { Badge, Card, CardHeader, EmptyState, StatTile, Table, TBody, TD, TH, THead, TR } from "@/components/ui/primitives";
import { getAuthContext } from "@/server/auth/session";
import { countDueItemsByStatus, listPlans } from "@/server/services/preventive";
import { generateAction } from "./actions";

export const metadata = { title: "Préventif" };

export default async function PreventivePage() {
  const ctx = await getAuthContext();
  if (!ctx.can("plan.read")) return <Forbidden what="le module préventif" />;
  const [plans, counts] = await Promise.all([listPlans(ctx), countDueItemsByStatus(ctx)]);

  return (
    <>
      <PageHeader
        title="Préventif"
        description="Plans d'entretien par catégorie ou modèle, échéances calendaires et compteur au premier seuil atteint (PRV-01 à PRV-12)."
        actions={
          <>
            {ctx.can("workorder.manage") ? (
              <ActionForm action={generateAction} showMessage>
                <SubmitButton variant="secondary">Générer les OT préventifs</SubmitButton>
              </ActionForm>
            ) : null}
            {ctx.can("plan.write") ? <ButtonLink href="/preventif/plans/nouveau">Nouveau plan</ButtonLink> : null}
          </>
        }
      />
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="En retard"
          value={counts.OVERDUE ?? 0}
          tone="red"
          href="/preventif/echeances?status=OVERDUE"
          hint="Au-delà de la tolérance"
        />
        <StatTile label="Échues" value={counts.DUE ?? 0} tone="amber" href="/preventif/echeances?status=DUE" />
        <StatTile label="En pré-alerte" value={counts.PRE_ALERT ?? 0} tone="blue" href="/preventif/echeances?status=PRE_ALERT" />
        <StatTile label="À venir" value={counts.UPCOMING ?? 0} tone="gray" href="/preventif/echeances?status=UPCOMING" />
      </div>
      <Card>
        <CardHeader
          title="Plans d'entretien"
          description="Un plan appliqué à un équipement crée une échéance par opération"
          actions={
            <Link href="/preventif/echeances" className="text-sm text-brand-700 hover:underline">
              Toutes les échéances
            </Link>
          }
        />
        {plans.length === 0 ? (
          <EmptyState title="Aucun plan" description="Créer un plan type par catégorie d'équipement." />
        ) : (
          <Table>
            <THead>
              <tr>
                <TH>Plan</TH>
                <TH>S&apos;applique à</TH>
                <TH className="text-right">Opérations</TH>
                <TH className="text-right">Équipements</TH>
                <TH>Version</TH>
              </tr>
            </THead>
            <TBody>
              {plans.map((p) => (
                <TR key={p.id}>
                  <TD>
                    <Link href={`/preventif/plans/${p.id}`} className="font-medium text-brand-700 hover:underline">
                      {p.name}
                    </Link>
                    {!p.active ? <Badge className="ml-2">Inactif</Badge> : null}
                    {p.description ? <p className="max-w-xl text-xs text-slate-500">{p.description}</p> : null}
                  </TD>
                  <TD>{[p.categoryName, p.modelName].filter(Boolean).join(" · ") || "—"}</TD>
                  <TD className="text-right tabular-nums">{p.operations}</TD>
                  <TD className="text-right tabular-nums">{p.equipmentCount}</TD>
                  <TD>v{p.version}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </Card>
    </>
  );
}
