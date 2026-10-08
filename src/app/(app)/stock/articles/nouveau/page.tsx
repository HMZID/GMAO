import { Forbidden } from "@/components/forbidden";
import { ActionForm, Field, SubmitButton } from "@/components/forms/action-form";
import { PageHeader } from "@/components/layout/page-header";
import { ButtonLink } from "@/components/ui/button";
import { Checkbox, Input, Select } from "@/components/ui/inputs";
import { Card, CardBody } from "@/components/ui/primitives";
import { PART_TRACKING, options } from "@/lib/labels";
import { getAuthContext } from "@/server/auth/session";
import { listPartFamilies } from "@/server/services/stock";
import { createPartAction } from "../../actions";

export const metadata = { title: "Nouvel article" };

export default async function NewPartPage() {
  const ctx = await getAuthContext();
  if (!ctx.can("part.write")) return <Forbidden what="la création d'articles" />;
  const families = await listPartFamilies(ctx);
  return (
    <>
      <PageHeader
        title="Nouvel article"
        description="Doublon refusé sur la référence interne et sur le couple fabricant + référence fabricant (STK-01)."
        back={{ href: "/stock", label: "Pièces et stocks" }}
      />
      <Card className="max-w-3xl">
        <CardBody>
          <ActionForm action={createPartAction} className="grid gap-4 sm:grid-cols-2">
            <Field label="Référence interne" name="sku" required>
              <Input id="sku" name="sku" required maxLength={40} placeholder="Ex. FLT-HUI-01" />
            </Field>
            <Field label="Désignation" name="name" required>
              <Input id="name" name="name" required maxLength={160} />
            </Field>
            <Field label="Famille" name="family">
              <Input id="family" name="family" list="families" maxLength={60} />
              <datalist id="families">
                {families.map((f) => (
                  <option key={f} value={f} />
                ))}
              </datalist>
            </Field>
            <Field label="Unité" name="unit" hint="u, L, kg, m, jeu…">
              <Input id="unit" name="unit" defaultValue="u" maxLength={10} />
            </Field>
            <Field label="Fabricant" name="manufacturer">
              <Input id="manufacturer" name="manufacturer" maxLength={80} />
            </Field>
            <Field label="Référence fabricant" name="manufacturerRef">
              <Input id="manufacturerRef" name="manufacturerRef" maxLength={80} />
            </Field>
            <Field label="Suivi" name="tracking">
              <Select id="tracking" name="tracking" defaultValue="QUANTITY" options={options(PART_TRACKING)} />
            </Field>
            <Field label="Criticité" name="criticality">
              <Select
                id="criticality"
                name="criticality"
                defaultValue="C"
                options={[
                  { value: "A", label: "A — rupture immobilisante" },
                  { value: "B", label: "B" },
                  { value: "C", label: "C" },
                ]}
              />
            </Field>
            <Checkbox name="isRepairable" label="Pièce réparable (échange standard)" className="sm:col-span-2" />
            <div className="flex items-center gap-3 border-t border-slate-100 pt-5 sm:col-span-2">
              <SubmitButton>Créer l&apos;article</SubmitButton>
              <ButtonLink href="/stock" variant="ghost">
                Annuler
              </ButtonLink>
            </div>
          </ActionForm>
        </CardBody>
      </Card>
    </>
  );
}
