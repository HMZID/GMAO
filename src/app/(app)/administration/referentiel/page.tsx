import { Forbidden } from "@/components/forbidden";
import { ActionForm, Field, SubmitButton } from "@/components/forms/action-form";
import { PageHeader } from "@/components/layout/page-header";
import { CriticalityBadge } from "@/components/status-badges";
import { Input, Select } from "@/components/ui/inputs";
import { Card, CardBody, CardHeader, Table, TBody, TD, TH, THead, TR } from "@/components/ui/primitives";
import { getAuthContext } from "@/server/auth/session";
import { listCategories, listModels } from "@/server/services/equipment";
import { createCategoryAction, createModelAction } from "../actions";

export const metadata = { title: "Référentiel équipements" };

export default async function ReferentialPage() {
  const ctx = await getAuthContext();
  if (!ctx.can("settings.manage")) return <Forbidden what="le référentiel" />;
  const [categories, models] = await Promise.all([listCategories(ctx), listModels(ctx)]);

  return (
    <>
      <PageHeader
        back={{ href: "/administration", label: "Administration" }}
        title="Référentiel équipements"
        description="Catégories (criticité par défaut, attributs propres) et modèles constructeur. Les plans d'entretien se rattachent à une catégorie ou à un modèle (EQP-03)."
      />
      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader title="Catégories" />
          <Table>
            <THead>
              <tr>
                <TH>Code</TH>
                <TH>Catégorie</TH>
                <TH>Criticité par défaut</TH>
                <TH>Attributs</TH>
                <TH className="text-right">Équipements</TH>
              </tr>
            </THead>
            <TBody>
              {categories.map((c) => (
                <TR key={c.id}>
                  <TD className="font-mono text-xs">{c.code}</TD>
                  <TD>{c.name}</TD>
                  <TD>
                    <CriticalityBadge value={c.defaultCriticality} />
                  </TD>
                  <TD className="text-xs text-slate-600">
                    {c.attributeDefinitions?.map((a) => `${a.label}${a.unit ? ` (${a.unit})` : ""}`).join(", ") || "—"}
                  </TD>
                  <TD className="text-right tabular-nums">{c.equipmentCount}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
          <CardBody className="border-t border-slate-100">
            <ActionForm action={createCategoryAction} resetOnSuccess className="grid gap-3 sm:grid-cols-4">
              <Field label="Code" name="code" required>
                <Input id="c-code" name="code" required maxLength={30} />
              </Field>
              <Field label="Nom" name="name" required className="sm:col-span-2">
                <Input id="c-name" name="name" required maxLength={120} />
              </Field>
              <Field label="Criticité" name="defaultCriticality">
                <Select id="c-crit" name="defaultCriticality" defaultValue="B" options={["A", "B", "C"].map((v) => ({ value: v, label: v }))} />
              </Field>
              <SubmitButton variant="secondary">Ajouter la catégorie</SubmitButton>
            </ActionForm>
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Modèles" />
          <Table>
            <THead>
              <tr>
                <TH>Marque</TH>
                <TH>Modèle</TH>
                <TH>Catégorie</TH>
              </tr>
            </THead>
            <TBody>
              {models.map((m) => (
                <TR key={m.id}>
                  <TD>{m.manufacturer}</TD>
                  <TD>{m.name}</TD>
                  <TD>{m.categoryName}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
          <CardBody className="border-t border-slate-100">
            <ActionForm action={createModelAction} resetOnSuccess className="grid gap-3 sm:grid-cols-3">
              <Field label="Catégorie" name="categoryId" required>
                <Select
                  id="m-cat"
                  name="categoryId"
                  required
                  placeholder="Choisir…"
                  options={categories.map((c) => ({ value: c.id, label: c.name }))}
                />
              </Field>
              <Field label="Marque" name="manufacturer" required>
                <Input id="m-mfr" name="manufacturer" required maxLength={80} />
              </Field>
              <Field label="Modèle" name="name" required>
                <Input id="m-name" name="name" required maxLength={120} />
              </Field>
              <SubmitButton variant="secondary">Ajouter le modèle</SubmitButton>
            </ActionForm>
          </CardBody>
        </Card>
      </div>
    </>
  );
}
