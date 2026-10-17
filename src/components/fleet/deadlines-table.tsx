import Link from "next/link";
import { updateDeadlineAction } from "@/app/(app)/equipements/echeances/actions";
import { ActionPanel, Field, PanelForm, SubmitButton } from "@/components/forms/action-form";
import { Disclosure } from "@/components/ui/disclosure";
import { Input } from "@/components/ui/inputs";
import { Badge, EmptyState, Table, TBody, TD, TH, THead, TR } from "@/components/ui/primitives";
import { formatCurrency, formatDate } from "@/lib/format";
import { DEADLINE_KIND, DEADLINE_STATE, DEADLINE_STATUS } from "@/lib/labels";
import type { AuthContext } from "@/server/authz/context";
import { daysUntil, deadlineState } from "@/server/domain/fleet-deadlines";
import type { listDeadlines } from "@/server/services/fleet-deadlines";

type Deadline = Awaited<ReturnType<typeof listDeadlines>>[number];

function delay(days: number) {
  if (days < 0) return `depuis ${-days} jour(s)`;
  if (days === 0) return "aujourd'hui";
  return `dans ${days} jour(s)`;
}

/**
 * Échéances administratives (assurance, visite technique, vignette) : état, délai, renouvellement et annulation.
 * Partagée par la fiche équipement et la liste du parc ; un seul panneau d'actions (la ligne renouvelée change).
 */
export function DeadlinesTable({
  items,
  ctx,
  now,
  showEquipment = false,
  emptyText = "Aucune échéance suivie.",
}: {
  items: Deadline[];
  ctx: AuthContext;
  now: Date;
  showEquipment?: boolean;
  emptyText?: string;
}) {
  return (
    <ActionPanel action={updateDeadlineAction} className="[&>[role]]:mx-5 [&>[role]]:mt-4">
      {items.length === 0 ? (
        <EmptyState title={emptyText} />
      ) : (
        <Table>
          <THead>
            <tr>
              {showEquipment ? <TH>Équipement</TH> : null}
              <TH>Échéance</TH>
              <TH>Date</TH>
              <TH>État</TH>
              <TH>Organisme</TH>
              <TH className="sr-only">Actions</TH>
            </tr>
          </THead>
          <TBody>
            {items.map((d) => {
              const open = d.status === "OPEN";
              const days = daysUntil(d.dueDate, now);
              const state = deadlineState(d.dueDate, now);
              const canWrite = open && ctx.canOn("equipment.write", d);
              return (
                <TR key={d.id}>
                  {showEquipment ? (
                    <TD>
                      <Link href={`/equipements/${d.equipmentId}`} className="font-medium text-brand-700 hover:underline">
                        {d.equipmentCode}
                      </Link>
                      <p className="text-xs text-slate-500">
                        {d.equipmentName} · {d.siteName}
                      </p>
                    </TD>
                  ) : null}
                  <TD>
                    <Badge tone={DEADLINE_KIND[d.kind]?.tone}>{DEADLINE_KIND[d.kind]?.label ?? d.kind}</Badge>
                    {d.label ? <p className="mt-1 text-sm text-slate-900">{d.label}</p> : null}
                    {d.reference ? <p className="text-xs text-slate-500">Réf. {d.reference}</p> : null}
                  </TD>
                  <TD className="whitespace-nowrap">
                    {formatDate(d.dueDate)}
                    {open ? <p className={days < 0 ? "text-xs font-medium text-red-700" : "text-xs text-slate-500"}>{delay(days)}</p> : null}
                  </TD>
                  <TD>
                    {open ? (
                      <Badge tone={DEADLINE_STATE[state].tone}>{DEADLINE_STATE[state].label}</Badge>
                    ) : (
                      <Badge tone={DEADLINE_STATUS[d.status]?.tone}>{DEADLINE_STATUS[d.status]?.label ?? d.status}</Badge>
                    )}
                  </TD>
                  <TD>
                    {d.provider ?? "—"}
                    {d.amount !== null ? <p className="text-xs text-slate-500">{formatCurrency(d.amount)}</p> : null}
                  </TD>
                  <TD className="text-right">
                    {canWrite ? (
                      <div className="flex flex-col items-end gap-2">
                        <Disclosure summary="Renouveler" className="text-left">
                          <PanelForm className="grid gap-3 sm:min-w-72">
                            <input type="hidden" name="deadlineId" value={d.id} />
                            <input type="hidden" name="intent" value="renew" />
                            <Field label="Nouvelle échéance" name="dueDate" required>
                              <Input type="date" name="dueDate" required />
                            </Field>
                            <Field label="Nouvelle référence" name="reference" hint="Police, procès-verbal, quittance">
                              <Input name="reference" maxLength={80} />
                            </Field>
                            <Field label="Montant payé" name="amount">
                              <Input type="number" name="amount" min={0} step="0.001" />
                            </Field>
                            <SubmitButton size="sm">Enregistrer le renouvellement</SubmitButton>
                          </PanelForm>
                        </Disclosure>
                        <Disclosure summary="Annuler" className="text-left">
                          <PanelForm className="grid gap-3 sm:min-w-72">
                            <input type="hidden" name="deadlineId" value={d.id} />
                            <input type="hidden" name="intent" value="cancel" />
                            <Field label="Motif" name="reason" required>
                              <Input name="reason" required maxLength={500} />
                            </Field>
                            <SubmitButton variant="danger" size="sm">
                              Annuler l&apos;échéance
                            </SubmitButton>
                          </PanelForm>
                        </Disclosure>
                      </div>
                    ) : null}
                  </TD>
                </TR>
              );
            })}
          </TBody>
        </Table>
      )}
    </ActionPanel>
  );
}
