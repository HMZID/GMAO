import { Forbidden } from "@/components/forbidden";
import { ActionForm, Field, SubmitButton } from "@/components/forms/action-form";
import { PageHeader } from "@/components/layout/page-header";
import { Disclosure } from "@/components/ui/disclosure";
import { Checkbox, Input } from "@/components/ui/inputs";
import { Badge, Card, EmptyState, Table, TBody, TD, TH, THead, TR } from "@/components/ui/primitives";
import { getAuthContext } from "@/server/auth/session";
import { listSuppliers } from "@/server/services/stock";
import { createSupplierAction } from "./actions";

export const metadata = { title: "Fournisseurs et prestataires" };

export default async function SuppliersPage() {
  const ctx = await getAuthContext();
  if (!ctx.can("supplier.read")) return <Forbidden what="les fournisseurs" />;
  const suppliers = await listSuppliers(ctx);

  return (
    <>
      <PageHeader
        title="Fournisseurs et prestataires"
        description="Référentiel unique (DON-12 : identifiant fiscal sans doublon). Commandes et réceptions sur commande : itération suivante (ACH-01 à ACH-09)."
      />
      {ctx.can("supplier.write") ? (
        <Disclosure summary="Nouveau fournisseur ou prestataire" className="mb-6">
          <ActionForm action={createSupplierAction} resetOnSuccess className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Raison sociale" name="name" required>
              <Input id="name" name="name" required maxLength={160} />
            </Field>
            <Field label="Identifiant fiscal (SIREN / TVA)" name="taxId">
              <Input id="taxId" name="taxId" maxLength={40} />
            </Field>
            <Field label="Courriel" name="email">
              <Input id="email" name="email" type="email" />
            </Field>
            <Field label="Téléphone" name="phone">
              <Input id="phone" name="phone" maxLength={30} />
            </Field>
            <Field label="Adresse" name="address" className="lg:col-span-2">
              <Input id="address" name="address" maxLength={300} />
            </Field>
            <Checkbox name="isContractor" label="Prestataire de maintenance (intervient sur les OT)" />
            <div className="sm:col-span-2 lg:col-span-3">
              <SubmitButton>Créer</SubmitButton>
            </div>
          </ActionForm>
        </Disclosure>
      ) : null}
      <Card>
        {suppliers.length === 0 ? (
          <EmptyState title="Aucun fournisseur" />
        ) : (
          <Table>
            <THead>
              <tr>
                <TH>Raison sociale</TH>
                <TH>Identifiant fiscal</TH>
                <TH>Contact</TH>
                <TH>Rôle</TH>
                <TH className="text-right">OT</TH>
              </tr>
            </THead>
            <TBody>
              {suppliers.map((s) => (
                <TR key={s.id}>
                  <TD className="font-medium text-slate-900">
                    {s.name}
                    {!s.active ? <Badge className="ml-2">Inactif</Badge> : null}
                  </TD>
                  <TD className="font-mono text-xs">{s.taxId ?? "—"}</TD>
                  <TD className="text-xs">
                    {s.email ? (
                      <a href={`mailto:${s.email}`} className="text-brand-700 hover:underline">
                        {s.email}
                      </a>
                    ) : null}
                    {s.phone ? <p className="text-slate-500">{s.phone}</p> : null}
                  </TD>
                  <TD>{s.isContractor ? <Badge tone="violet">Prestataire</Badge> : <Badge>Fournisseur</Badge>}</TD>
                  <TD className="text-right tabular-nums">{s.workOrderCount}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </Card>
    </>
  );
}
