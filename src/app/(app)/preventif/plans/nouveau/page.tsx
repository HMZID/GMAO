import { Forbidden } from "@/components/forbidden";
import { ActionForm, Field, SubmitButton } from "@/components/forms/action-form";
import { PageHeader } from "@/components/layout/page-header";
import { ButtonLink } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/inputs";
import { Card, CardBody } from "@/components/ui/primitives";
import { getAuthContext } from "@/server/auth/session";
import { getEquipmentFormOptions } from "@/server/services/equipment";
import { createPlanAction } from "../../actions";
import { OperationFields } from "../../operation-fields";

export const metadata = { title: "Nouveau plan d'entretien" };

export default async function NewPlanPage() {
  const ctx = await getAuthContext();
  if (!ctx.can("plan.write")) return <Forbidden what="la création de plans" />;
  const opts = await getEquipmentFormOptions(ctx);
  return (
    <>
      <PageHeader
        title="Nouveau plan d'entretien"
        description="Le plan est appliqué aux équipements de la catégorie ou du modèle à leur création ; il peut aussi être appliqué depuis la fiche d'un équipement. Les opérations suivantes s'ajoutent depuis la fiche du plan."
        back={{ href: "/preventif", label: "Préventif" }}
      />
      <Card className="max-w-4xl">
        <CardBody>
          <ActionForm action={createPlanAction} className="space-y-8">
            <fieldset className="grid gap-4 sm:grid-cols-2">
              <legend className="mb-3 text-sm font-semibold text-slate-900">Plan</legend>
              <Field label="Nom du plan" name="planName" required className="sm:col-span-2">
                <Input id="planName" name="planName" required maxLength={160} placeholder="Ex. Chargeuse sur pneus — entretien périodique" />
              </Field>
              <Field label="Catégorie" name="categoryId">
                <Select id="categoryId" name="categoryId" placeholder="—" options={opts.categories.map((c) => ({ value: c.id, label: c.label }))} />
              </Field>
              <Field label="ou modèle" name="modelId">
                <Select id="modelId" name="modelId" placeholder="—" options={opts.models.map((m) => ({ value: m.id, label: m.label }))} />
              </Field>
              <Field label="Description" name="description" className="sm:col-span-2">
                <Textarea id="description" name="description" rows={2} />
              </Field>
            </fieldset>
            <fieldset>
              <legend className="mb-3 text-sm font-semibold text-slate-900">Première opération</legend>
              <OperationFields />
            </fieldset>
            <div className="flex items-center gap-3 border-t border-slate-100 pt-5">
              <SubmitButton>Créer le plan</SubmitButton>
              <ButtonLink href="/preventif" variant="ghost">
                Annuler
              </ButtonLink>
            </div>
          </ActionForm>
        </CardBody>
      </Card>
    </>
  );
}
