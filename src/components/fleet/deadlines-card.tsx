import Link from "next/link";
import { createDeadlineAction } from "@/app/(app)/equipements/echeances/actions";
import { ActionForm, Field, SubmitButton } from "@/components/forms/action-form";
import { Disclosure } from "@/components/ui/disclosure";
import { Input, Select, Textarea } from "@/components/ui/inputs";
import { Card, CardBody, CardHeader } from "@/components/ui/primitives";
import { DEADLINE_KIND, options } from "@/lib/labels";
import type { AuthContext } from "@/server/authz/context";
import { listDeadlines } from "@/server/services/fleet-deadlines";
import { DeadlinesTable } from "./deadlines-table";
import { T } from "@/i18n/client";

/** Carte « Échéances administratives » de la fiche équipement : assurance, visite technique, vignette. */
export async function DeadlinesCard({
  ctx,
  equipment,
  retired,
  now,
}: {
  ctx: AuthContext;
  equipment: { id: string; companyId: string; siteId: string | null };
  retired: boolean;
  /** Instant de référence (lu après l'accès à la session). */
  now: Date;
}) {
  const items = await listDeadlines(ctx, { equipmentId: equipment.id, horizon: "history" }, now);
  // Les échéances en cours d'abord, puis l'historique (renouvelées, annulées), le plus récent en tête.
  const open = items.filter((d) => d.status === "OPEN");
  const past = items.filter((d) => d.status !== "OPEN").reverse();
  const canWrite = !retired && ctx.canOn("equipment.write", equipment);

  return (
    <Card>
      <CardHeader
        title="Échéances administratives"
        description="Assurance, visite technique, vignette : alertes au responsable du parc à J−30, J−7 et à l'échéance"
        actions={
          <Link href="/equipements/echeances" className="text-sm text-brand-700 hover:underline">
            <T>Tout le parc</T>
          </Link>
        }
      />
      <DeadlinesTable items={[...open, ...past.slice(0, 5)]} ctx={ctx} now={now} emptyText="Aucune échéance administrative suivie." />
      {canWrite ? (
        <CardBody className="border-t border-slate-100">
          <Disclosure summary="Ajouter une échéance">
            <ActionForm action={createDeadlineAction.bind(null, equipment.id)} resetOnSuccess className="grid gap-4 sm:grid-cols-2">
              <Field label="Type" name="kind" required>
                <Select name="kind" required options={options(DEADLINE_KIND)} defaultValue="INSURANCE" />
              </Field>
              <Field label="Date d'échéance" name="dueDate" required>
                <Input type="date" name="dueDate" required />
              </Field>
              <Field label="Libellé" name="label" hint="Par défaut : le type">
                <Input name="label" maxLength={120} />
              </Field>
              <Field label="Organisme" name="provider" hint="Assureur, centre de visite, recette des finances">
                <Input name="provider" maxLength={120} />
              </Field>
              <Field label="Référence" name="reference" hint="Police, procès-verbal, quittance">
                <Input name="reference" maxLength={80} />
              </Field>
              <Field label="Montant" name="amount">
                <Input type="number" name="amount" min={0} step="0.001" />
              </Field>
              <Field label="Notes" name="notes" className="sm:col-span-2">
                <Textarea name="notes" rows={2} maxLength={1000} />
              </Field>
              <div className="sm:col-span-2">
                <SubmitButton>
                  <T>Enregistrer l&apos;échéance</T>
                </SubmitButton>
              </div>
            </ActionForm>
          </Disclosure>
        </CardBody>
      ) : null}
    </Card>
  );
}
