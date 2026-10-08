import { addStepAction, createWorkflowAction, removeStepAction, setWorkflowActiveAction } from "@/app/(app)/validations/actions";
import { Forbidden } from "@/components/forbidden";
import { ActionForm, ActionPanel, Field, PanelForm, SubmitButton } from "@/components/forms/action-form";
import { PageHeader } from "@/components/layout/page-header";
import { Disclosure } from "@/components/ui/disclosure";
import { Checkbox, Input, Select } from "@/components/ui/inputs";
import { Badge, Card, CardBody, CardHeader, EmptyState, Table, TBody, TD, TH, THead, TR } from "@/components/ui/primitives";
import { formatCurrency } from "@/lib/format";
import { APPROVAL_OBJECT, ROLE, options } from "@/lib/labels";
import { getAuthContext } from "@/server/auth/session";
import { listUserOptions, listWorkflows } from "@/server/services/approvals";
import { listCompanies } from "@/server/services/organization";

export const metadata = { title: "Circuits de validation" };

export default async function ApprovalWorkflowsPage() {
  const ctx = await getAuthContext();
  if (!ctx.can("settings.manage")) return <Forbidden what="le paramétrage des circuits de validation" />;
  const [workflows, companies, users] = await Promise.all([listWorkflows(ctx), listCompanies(ctx), listUserOptions(ctx)]);
  const userOptions = users.map((u) => ({ value: u.id, label: u.name }));

  return (
    <>
      <PageHeader
        back={{ href: "/administration", label: "Administration" }}
        title="Circuits de validation"
        description="Par type d'objet et par société (le circuit du groupe s'applique à défaut). Une étape s'applique à partir de son seuil et, pour les DI, aux priorités choisies. Les demandes déjà soumises gardent leurs étapes (HAB-04)."
      />

      <Disclosure summary="Nouveau circuit" className="mb-6">
        <ActionForm action={createWorkflowAction} resetOnSuccess className="grid gap-4 sm:grid-cols-3">
          <Field label="Objet" name="objectType" required>
            <Select name="objectType" required options={options(APPROVAL_OBJECT)} />
          </Field>
          <Field label="Société" name="companyId" hint="Vide : tout le groupe">
            <Select name="companyId" placeholder="Tout le groupe" options={companies.map((c) => ({ value: c.id, label: c.name }))} />
          </Field>
          <Field label="Nom" name="name" required>
            <Input name="name" required maxLength={120} />
          </Field>
          <div className="sm:col-span-3">
            <SubmitButton>Créer le circuit</SubmitButton>
          </div>
        </ActionForm>
      </Disclosure>

      {workflows.length === 0 ? (
        <Card>
          <EmptyState title="Aucun circuit" description="Sans circuit, les demandes ne sont pas soumises à validation." />
        </Card>
      ) : (
        <div className="space-y-6">
          {workflows.map((w) => (
            <Card key={w.id}>
              <CardHeader
                title={w.name}
                description={`${APPROVAL_OBJECT[w.objectType]} · ${w.companyName ?? "Tout le groupe"}`}
                actions={
                  <ActionPanel action={setWorkflowActiveAction} className="flex items-center gap-2">
                    <Badge tone={w.active ? "green" : "gray"}>{w.active ? "Actif" : "Inactif"}</Badge>
                    <PanelForm>
                      <input type="hidden" name="workflowId" value={w.id} />
                      <input type="hidden" name="active" value={w.active ? "false" : "true"} />
                      <SubmitButton variant="ghost" size="sm">
                        {w.active ? "Désactiver" : "Activer"}
                      </SubmitButton>
                    </PanelForm>
                  </ActionPanel>
                }
              />
              <ActionPanel action={removeStepAction} className="[&>[role]]:mx-5 [&>[role]]:mt-4">
                {w.steps.length === 0 ? (
                  <EmptyState title="Aucune étape" description="Ajouter au moins une étape pour que le circuit s'applique." />
                ) : (
                  <Table>
                    <THead>
                      <tr>
                        <TH>Ordre</TH>
                        <TH>Étape</TH>
                        <TH>Valideur</TH>
                        <TH>À partir de</TH>
                        <TH>Priorités</TH>
                        <TH className="sr-only">Actions</TH>
                      </tr>
                    </THead>
                    <TBody>
                      {w.steps.map((s) => (
                        <TR key={s.id}>
                          <TD className="tabular-nums">{s.position}</TD>
                          <TD className="font-medium text-slate-900">{s.name}</TD>
                          <TD>{s.approverRole ? `${ROLE[s.approverRole] ?? s.approverRole} (périmètre de l'objet)` : (s.approverName ?? "—")}</TD>
                          <TD className="tabular-nums">{s.minAmount != null ? formatCurrency(s.minAmount) : "Toujours"}</TD>
                          <TD>{s.priorities.length > 0 ? s.priorities.join(", ") : "Toutes"}</TD>
                          <TD className="text-right">
                            <PanelForm>
                              <input type="hidden" name="stepId" value={s.id} />
                              <SubmitButton variant="ghost" size="sm">
                                Retirer
                              </SubmitButton>
                            </PanelForm>
                          </TD>
                        </TR>
                      ))}
                    </TBody>
                  </Table>
                )}
              </ActionPanel>
              <CardBody className="border-t border-slate-100">
                <Disclosure summary="Ajouter une étape">
                  <ActionForm action={addStepAction.bind(null, w.id)} resetOnSuccess className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <Field label="Nom de l'étape" name="name" required>
                      <Input name="name" required maxLength={120} placeholder="Ex. Direction" />
                    </Field>
                    <Field label="Rôle valideur" name="approverRole" hint="Dans la société ou le site de l'objet">
                      <Select name="approverRole" placeholder="—" options={options(ROLE)} />
                    </Field>
                    <Field label="Ou personne nommée" name="approverUserId">
                      <Select name="approverUserId" placeholder="—" options={userOptions} />
                    </Field>
                    <Field label="Seuil (€)" name="minAmount" hint="Vide : quel que soit le montant">
                      <Input name="minAmount" type="number" min="0" step="0.01" />
                    </Field>
                    {w.objectType === "WORK_REQUEST" ? (
                      <fieldset className="space-y-1 sm:col-span-2 lg:col-span-4">
                        <legend className="text-sm font-medium text-slate-700">Priorités concernées (aucune cochée : toutes)</legend>
                        <div className="flex flex-wrap gap-4">
                          {["P1", "P2", "P3", "P4"].map((p) => (
                            <Checkbox key={p} name="priorities[]" value={p} label={p} />
                          ))}
                        </div>
                      </fieldset>
                    ) : null}
                    <div className="sm:col-span-2 lg:col-span-4">
                      <SubmitButton>Ajouter l&apos;étape</SubmitButton>
                    </div>
                  </ActionForm>
                </Disclosure>
              </CardBody>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
