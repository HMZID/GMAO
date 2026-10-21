import Link from "next/link";
import { createFuelCardAction, updateFuelCardAction } from "@/app/(app)/carburant/actions";
import { Forbidden } from "@/components/forbidden";
import { ActionForm, ActionPanel, Field, PanelForm, SubmitButton } from "@/components/forms/action-form";
import { PageHeader } from "@/components/layout/page-header";
import { Disclosure } from "@/components/ui/disclosure";
import { Input, Select } from "@/components/ui/inputs";
import { Badge, Card, CardHeader, EmptyState, Table, TBody, TD, TH, THead, TR } from "@/components/ui/primitives";
import { formatDate, formatNumber, toDateInput } from "@/lib/format";
import { getAuthContext } from "@/server/auth/session";
import { listFuelCards, listFuelEquipmentOptions } from "@/server/services/fuel";
import { listCompanies } from "@/server/services/organization";
import { T } from "@/i18n/client";

export const metadata = { title: "Cartes carburant" };

export default async function FuelCardsPage() {
  const ctx = await getAuthContext();
  if (!ctx.can("fuel.read")) return <Forbidden what="les cartes carburant" />;
  const canManage = ctx.can("fuel.manage");
  const [cards, companies, equipment] = await Promise.all([
    listFuelCards(ctx),
    canManage ? listCompanies(ctx) : Promise.resolve([]),
    canManage ? listFuelEquipmentOptions(ctx) : Promise.resolve([]),
  ]);
  const equipmentOptions = equipment.map((e) => ({ value: e.id, label: `${e.code} — ${e.name}` }));

  return (
    <>
      <PageHeader
        back={{ href: "/carburant", label: "Carburant" }}
        title="Cartes carburant"
        description="Seuls les 4 derniers chiffres sont conservés. Une carte affectée à un équipement signale tout plein fait pour un autre ; le plafond mensuel signale les dépassements."
      />

      {canManage ? (
        <Disclosure summary="Nouvelle carte" className="mb-6">
          <ActionForm action={createFuelCardAction} resetOnSuccess className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Société" name="companyId" required>
              <Select name="companyId" required options={companies.map((c) => ({ value: c.id, label: c.name }))} />
            </Field>
            <Field label="Fournisseur" name="provider" required hint="Agil, Total, Shell, Star…">
              <Input name="provider" required maxLength={60} />
            </Field>
            <Field label="Numéro de carte" name="cardNumber" required hint="Seuls les 4 derniers chiffres sont gardés">
              <Input name="cardNumber" required maxLength={40} inputMode="numeric" autoComplete="off" />
            </Field>
            <Field label="Libellé" name="label">
              <Input name="label" maxLength={80} />
            </Field>
            <Field label="Équipement affecté" name="equipmentId">
              <Select name="equipmentId" placeholder="Aucun (carte de pool)" options={equipmentOptions} />
            </Field>
            <Field label="Titulaire" name="holderName">
              <Input name="holderName" maxLength={120} />
            </Field>
            <Field label="Valable jusqu'au" name="validTo">
              <Input name="validTo" type="date" />
            </Field>
            <Field label="Plafond mensuel (L)" name="monthlyLimitLitres">
              <Input name="monthlyLimitLitres" type="number" min="1" step="1" />
            </Field>
            <div className="sm:col-span-2 lg:col-span-4">
              <SubmitButton>
                <T>Enregistrer la carte</T>
              </SubmitButton>
            </div>
          </ActionForm>
        </Disclosure>
      ) : null}

      <Card>
        <CardHeader title="Cartes" description="Actives en premier" />
        <ActionPanel action={updateFuelCardAction} className="[&>[role]]:mx-5 [&>[role]]:mt-4">
          {cards.length === 0 ? (
            <EmptyState title="Aucune carte carburant" description="Déclarer les cartes pour rapprocher les relevés et contrôler leur usage." />
          ) : (
            <Table>
              <THead>
                <tr>
                  <TH>
                    <T>Carte</T>
                  </TH>
                  <TH>
                    <T>Équipement affecté</T>
                  </TH>
                  <TH>
                    <T>Titulaire</T>
                  </TH>
                  <TH className="text-end">
                    <T>Plafond mensuel</T>
                  </TH>
                  <TH>
                    <T>État</T>
                  </TH>
                </tr>
              </THead>
              <TBody>
                {cards.map((c) => (
                  <TR key={c.id} className={c.active ? undefined : "opacity-60"}>
                    <TD>
                      <span className="font-medium text-slate-900">
                        {c.provider} …{c.last4}
                      </span>
                      <p className="text-xs text-slate-500">
                        {c.label ? `${c.label} · ` : ""}
                        {c.companyName}
                      </p>
                    </TD>
                    <TD>
                      {c.equipmentId ? (
                        <Link href={`/equipements/${c.equipmentId}`} className="text-brand-700 hover:underline">
                          {c.equipmentCode}
                        </Link>
                      ) : (
                        <span className="text-slate-400">
                          <T>Carte de pool</T>
                        </span>
                      )}
                    </TD>
                    <TD>
                      {c.holderName ?? "—"}
                      {c.validTo ? (
                        <p className="text-xs text-slate-500">
                          <T params={{ date: formatDate(c.validTo) }}>{"Valable jusqu'au {date}"}</T>
                        </p>
                      ) : null}
                    </TD>
                    <TD className="text-end tabular-nums">{c.monthlyLimitLitres ? formatNumber(c.monthlyLimitLitres, "L") : "—"}</TD>
                    <TD>
                      <Badge tone={c.active ? "green" : "gray"}>
                        <T>{c.active ? "Active" : "Désactivée"}</T>
                      </Badge>
                      {canManage && ctx.canOn("fuel.manage", { companyId: c.companyId }) ? (
                        <Disclosure summary="Modifier" className="mt-2">
                          <PanelForm className="grid gap-3 sm:grid-cols-2">
                            <input type="hidden" name="cardId" value={c.id} />
                            <Field label="Équipement affecté" name="equipmentId">
                              <Select
                                name="equipmentId"
                                placeholder="Aucun (carte de pool)"
                                defaultValue={c.equipmentId ?? ""}
                                options={equipmentOptions}
                              />
                            </Field>
                            <Field label="Plafond mensuel (L)" name="monthlyLimitLitres">
                              <Input name="monthlyLimitLitres" type="number" min="1" step="1" defaultValue={c.monthlyLimitLitres ?? ""} />
                            </Field>
                            <Field label="Titulaire" name="holderName">
                              <Input name="holderName" maxLength={120} defaultValue={c.holderName ?? ""} />
                            </Field>
                            <Field label="Valable jusqu'au" name="validTo">
                              <Input name="validTo" type="date" defaultValue={toDateInput(c.validTo)} />
                            </Field>
                            <Field label="État" name="active">
                              <Select
                                name="active"
                                defaultValue={c.active ? "true" : "false"}
                                options={[
                                  { value: "true", label: "Active" },
                                  { value: "false", label: "Désactivée" },
                                ]}
                              />
                            </Field>
                            <div className="flex items-end">
                              <SubmitButton size="sm">
                                <T>Enregistrer</T>
                              </SubmitButton>
                            </div>
                          </PanelForm>
                        </Disclosure>
                      ) : null}
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </ActionPanel>
      </Card>
    </>
  );
}
