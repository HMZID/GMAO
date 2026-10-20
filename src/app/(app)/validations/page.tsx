import Link from "next/link";
import { ActionForm, ActionPanel, Field, PanelForm, SubmitButton } from "@/components/forms/action-form";
import { PageHeader } from "@/components/layout/page-header";
import { Disclosure } from "@/components/ui/disclosure";
import { Input, Select, Textarea } from "@/components/ui/inputs";
import { Alert, Badge, Card, CardBody, CardHeader, EmptyState, Table, TBody, TD, TH, THead, TR } from "@/components/ui/primitives";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/format";
import { APPROVAL_OBJECT, APPROVAL_STATUS } from "@/lib/labels";
import { getAuthContext } from "@/server/auth/session";
import { listMyApprovalRequests, listMySubstitutes, listPendingForMe, listUserOptions, objectLink } from "@/server/services/approvals";
import { countPendingInventoryCounts } from "@/server/services/inventory";
import { addSubstituteAction, decideFromListAction, removeSubstituteAction } from "./actions";
import { T, Tr } from "@/i18n/client";
import { tpl } from "@/i18n/translate";

export const metadata = { title: "Validations" };

export default async function ValidationsPage() {
  const ctx = await getAuthContext();
  const now = new Date();
  const [pending, mine, substitutes, users, inventoryPending] = await Promise.all([
    listPendingForMe(ctx, now),
    listMyApprovalRequests(ctx),
    listMySubstitutes(ctx),
    listUserOptions(ctx),
    countPendingInventoryCounts(ctx),
  ]);

  return (
    <>
      <PageHeader
        title="Validations"
        description="Demandes d'intervention, demandes d'achat et dépenses soumises à un circuit de validation. Le demandeur ne valide jamais sa propre demande."
      />

      {inventoryPending > 0 ? (
        <div className="mb-6">
          <Alert tone="amber">
            <T params={{ n: inventoryPending }}>{"{n} écart(s) d'inventaire à valider :"}</T>{" "}
            <Link href="/stock/inventaire" className="font-medium underline">
              <T>ouvrir l&apos;inventaire</T>
            </Link>
            .
          </Alert>
        </div>
      ) : null}

      <Card className="mb-6">
        <CardHeader title={tpl`À valider (${pending.length})`} description="Étapes dont vous êtes valideur, directement ou comme suppléant" />
        {/* Un seul panneau pour la liste : le message reste affiché quand la demande tranchée disparaît. */}
        <ActionPanel action={decideFromListAction} className="[&>[role]]:mx-5 [&>[role]]:mt-4">
          {pending.length === 0 ? (
            <EmptyState title="Rien à valider" description="Les demandes qui attendent votre décision apparaîtront ici." />
          ) : (
            <ul className="divide-y divide-slate-100">
              {pending.map((p) => (
                <li key={p.id} className="grid gap-4 px-5 py-4 lg:grid-cols-[1fr_22rem]">
                  <div className="space-y-1 text-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone="violet">
                        <Tr>{APPROVAL_OBJECT[p.objectType]}</Tr>
                      </Badge>
                      {p.amount != null ? <span className="font-semibold tabular-nums text-slate-900">{formatCurrency(p.amount)}</span> : null}
                    </div>
                    <Link href={p.link} className="block font-medium text-brand-700 hover:underline">
                      <Tr>{p.label}</Tr>
                    </Link>
                    <p className="text-slate-600">
                      <T
                        params={{ name: p.step.name, companyName: p.companyName, requesterName: p.requesterName, date: formatDateTime(p.createdAt) }}
                      >
                        {"Étape « {name} » · {companyName} · demandé par {requesterName} le {date}"}
                      </T>
                    </p>
                    {p.onBehalfOf ? (
                      <p className="text-xs text-amber-700">
                        <T>Vous décidez comme suppléant.</T>
                      </p>
                    ) : null}
                  </div>
                  <PanelForm className="space-y-2">
                    <input type="hidden" name="requestId" value={p.id} />
                    <Field label="Commentaire" name="comment" hint="Obligatoire en cas de refus">
                      <Textarea name="comment" rows={2} maxLength={1000} />
                    </Field>
                    <div className="flex gap-2">
                      <SubmitButton name="decision" value="APPROVED" size="sm">
                        <T>Valider</T>
                      </SubmitButton>
                      <SubmitButton name="decision" value="REJECTED" variant="danger" size="sm">
                        <T>Refuser</T>
                      </SubmitButton>
                    </div>
                  </PanelForm>
                </li>
              ))}
            </ul>
          )}
        </ActionPanel>
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader title="Mes demandes soumises" description="30 dernières" />
          {mine.length === 0 ? (
            <EmptyState title="Aucune demande soumise à validation" />
          ) : (
            <Table>
              <THead>
                <tr>
                  <TH>
                    <T>Objet</T>
                  </TH>
                  <TH>
                    <T>Statut</T>
                  </TH>
                  <TH className="text-end">
                    <T>Montant</T>
                  </TH>
                </tr>
              </THead>
              <TBody>
                {mine.map((r) => (
                  <TR key={r.id}>
                    <TD>
                      <Link href={objectLink(r.objectType, r.objectId)} className="font-medium text-brand-700 hover:underline">
                        <Tr>{r.label}</Tr>
                      </Link>
                      <p className="text-xs text-slate-500">
                        <Tr>{APPROVAL_OBJECT[r.objectType]}</Tr> · {formatDateTime(r.createdAt)}
                        {r.status === "PENDING" ? (
                          <>
                            {" · "}
                            <T params={{ step: r.steps.find((s) => s.position === r.currentPosition)?.name ?? "" }}>{"étape « {step} »"}</T>
                          </>
                        ) : null}
                      </p>
                    </TD>
                    <TD>
                      <Badge tone={APPROVAL_STATUS[r.status]?.tone}>
                        <Tr>{APPROVAL_STATUS[r.status]?.label}</Tr>
                      </Badge>
                    </TD>
                    <TD className="text-end tabular-nums">{r.amount != null ? formatCurrency(r.amount) : "—"}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </Card>

        <Card>
          <CardHeader title="Suppléance" description="Pendant une absence, votre suppléant décide à votre place ; chaque décision le mentionne." />
          <CardBody className="space-y-4">
            {substitutes.length === 0 ? (
              <p className="text-sm text-slate-500">
                <T>Aucune suppléance.</T>
              </p>
            ) : (
              <ActionPanel action={removeSubstituteAction}>
                <ul className="divide-y divide-slate-100 text-sm">
                  {substitutes.map((s) => {
                    const active = s.validFrom <= now && now <= s.validTo;
                    return (
                      <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                        <span>
                          <Tr>{s.given ? `${s.substituteName} vous remplace` : tpl`Vous remplacez ${s.userName}`}</Tr> du {formatDate(s.validFrom)} au{" "}
                          {formatDate(s.validTo)}
                          {active ? (
                            <Badge tone="green" className="ms-2">
                              <T>En cours</T>
                            </Badge>
                          ) : null}
                        </span>
                        {s.given ? (
                          <PanelForm>
                            <input type="hidden" name="id" value={s.id} />
                            <SubmitButton variant="ghost" size="sm">
                              <T>Retirer</T>
                            </SubmitButton>
                          </PanelForm>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              </ActionPanel>
            )}
            <Disclosure summary="Désigner un suppléant">
              <ActionForm action={addSubstituteAction} resetOnSuccess className="grid gap-3 sm:grid-cols-3">
                <Field label="Suppléant" name="substituteUserId" required className="sm:col-span-3">
                  <Select
                    name="substituteUserId"
                    required
                    placeholder="Choisir…"
                    options={users.filter((u) => u.id !== ctx.userId).map((u) => ({ value: u.id, label: `${u.name} (${u.email})` }))}
                  />
                </Field>
                <Field label="Du" name="validFrom" required>
                  <Input type="date" name="validFrom" required />
                </Field>
                <Field label="Au (inclus)" name="validTo" required>
                  <Input type="date" name="validTo" required />
                </Field>
                <div className="flex items-end">
                  <SubmitButton>
                    <T>Désigner</T>
                  </SubmitButton>
                </div>
              </ActionForm>
            </Disclosure>
          </CardBody>
        </Card>
      </div>
    </>
  );
}
