import {
  addStepAction,
  createWorkflowAction,
  removeStepAction,
  setWorkflowActiveAction,
  setWorkOrderValidationAction,
} from "@/app/(app)/validations/actions";
import { Forbidden } from "@/components/forbidden";
import { ActionForm, ActionPanel, Field, PanelForm, SubmitButton } from "@/components/forms/action-form";
import { PageHeader } from "@/components/layout/page-header";
import { Disclosure } from "@/components/ui/disclosure";
import { Checkbox, Input, Select } from "@/components/ui/inputs";
import { Badge, Card, CardBody, CardHeader, EmptyState, Table, TBody, TD, TH, THead, TR } from "@/components/ui/primitives";
import { formatCurrency } from "@/lib/format";
import { APPROVAL_OBJECT, ROLE, options } from "@/lib/labels";
import { getAuthContext } from "@/server/auth/session";
import { getWorkOrderValidationSetting, listUserOptions, listWorkflows } from "@/server/services/approvals";
import { listCompanies } from "@/server/services/organization";
import { T, Tr } from "@/i18n/client";
import { tpl } from "@/i18n/translate";

export const metadata = { title: "Circuits de validation" };

export default async function ApprovalWorkflowsPage() {
  const ctx = await getAuthContext();
  if (!ctx.can("settings.manage")) return <Forbidden what="le paramétrage des circuits de validation" />;
  const [workflows, companies, users, setting] = await Promise.all([
    listWorkflows(ctx),
    listCompanies(ctx),
    listUserOptions(ctx),
    getWorkOrderValidationSetting(ctx),
  ]);
  const canSetThreshold = ctx.can("approval.threshold");
  const userOptions = users.map((u) => ({ value: u.id, label: u.name }));

  return (
    <>
      <PageHeader
        back={{ href: "/administration", label: "Administration" }}
        title="Circuits de validation"
        description="Par type d'objet et par société (le circuit du groupe s'applique à défaut). Une étape s'applique à partir de son seuil et, pour les demandes d'intervention, aux priorités choisies. Les demandes déjà soumises gardent leurs étapes."
      />

      <Card className="mb-6">
        <CardHeader
          title="Validation des interventions"
          description="Le responsable maintenance valide toutes les interventions dont le coût estimé est inférieur au seuil ; à partir du seuil, la direction valide. La direction crée sans validation et peut tout valider."
          actions={
            <Badge tone={setting.enabled ? "green" : "gray"}>
              <Tr>{setting.enabled ? "Actif" : "Inactif"}</Tr>
            </Badge>
          }
        />
        <CardBody>
          {canSetThreshold ? (
            <ActionForm action={setWorkOrderValidationAction} className="grid gap-4 sm:grid-cols-3">
              <div className="flex items-end">
                <Checkbox name="enabled" label="Soumettre les interventions à validation" defaultChecked={setting.enabled} />
              </div>
              <Field label="Seuil de la direction (€)" name="threshold" hint="Vide : le responsable maintenance valide toutes les interventions">
                <Input name="threshold" type="number" min="0" step="0.01" defaultValue={setting.threshold ?? ""} />
              </Field>
              <div className="flex items-end">
                <SubmitButton>
                  <T>Enregistrer</T>
                </SubmitButton>
              </div>
            </ActionForm>
          ) : (
            <p className="text-sm text-slate-700">
              <T params={{ threshold: setting.threshold !== null ? formatCurrency(setting.threshold) : "" }}>
                {setting.enabled
                  ? setting.threshold !== null
                    ? "Interventions validées par le responsable maintenance sous {threshold}, par la direction à partir de ce montant. Le seuil est fixé par la direction."
                    : "Interventions validées par le responsable maintenance, sans seuil. Le seuil est fixé par la direction."
                  : "Les interventions ne sont pas soumises à validation. Le seuil est fixé par la direction."}
              </T>
            </p>
          )}
        </CardBody>
      </Card>

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
            <SubmitButton>
              <T>Créer le circuit</T>
            </SubmitButton>
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
                    <Badge tone={w.active ? "green" : "gray"}>
                      <Tr>{w.active ? "Actif" : "Inactif"}</Tr>
                    </Badge>
                    <PanelForm>
                      <input type="hidden" name="workflowId" value={w.id} />
                      <input type="hidden" name="active" value={w.active ? "false" : "true"} />
                      <SubmitButton variant="ghost" size="sm">
                        <Tr>{w.active ? "Désactiver" : "Activer"}</Tr>
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
                        <TH>
                          <T>Ordre</T>
                        </TH>
                        <TH>
                          <T>Étape</T>
                        </TH>
                        <TH>
                          <T>Valideur</T>
                        </TH>
                        <TH>
                          <T>Montant</T>
                        </TH>
                        <TH>
                          <T>Priorités</T>
                        </TH>
                        <TH className="sr-only">
                          <T>Actions</T>
                        </TH>
                      </tr>
                    </THead>
                    <TBody>
                      {w.steps.map((s) => (
                        <TR key={s.id}>
                          <TD className="tabular-nums">{s.position}</TD>
                          <TD className="font-medium text-slate-900">{s.name}</TD>
                          <TD>
                            <Tr>
                              {s.approverRole ? tpl`${ROLE[s.approverRole] ?? s.approverRole} (périmètre de l'objet)` : (s.approverName ?? "—")}
                            </Tr>
                          </TD>
                          <TD className="tabular-nums">
                            <Tr>
                              {s.minAmount != null
                                ? tpl`À partir de ${formatCurrency(s.minAmount)}`
                                : s.maxAmount != null
                                  ? tpl`Moins de ${formatCurrency(s.maxAmount)}`
                                  : "Toujours"}
                            </Tr>
                          </TD>
                          <TD>
                            <Tr>{s.priorities.length > 0 ? s.priorities.join(", ") : "Toutes"}</Tr>
                          </TD>
                          <TD className="text-end">
                            <PanelForm>
                              <input type="hidden" name="stepId" value={s.id} />
                              <SubmitButton variant="ghost" size="sm">
                                <T>Retirer</T>
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
                        <legend className="text-sm font-medium text-slate-700">
                          <T>Priorités concernées (aucune cochée : toutes)</T>
                        </legend>
                        <div className="flex flex-wrap gap-4">
                          {["P1", "P2", "P3", "P4"].map((p) => (
                            <Checkbox key={p} name="priorities[]" value={p} label={p} />
                          ))}
                        </div>
                      </fieldset>
                    ) : null}
                    <div className="sm:col-span-2 lg:col-span-4">
                      <SubmitButton>
                        <T>Ajouter l&apos;étape</T>
                      </SubmitButton>
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
