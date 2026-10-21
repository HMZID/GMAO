import Link from "next/link";
import { reviewFuelAction } from "@/app/(app)/carburant/actions";
import { ActionPanel, Field, PanelForm, SubmitButton } from "@/components/forms/action-form";
import { Disclosure } from "@/components/ui/disclosure";
import { Input, Select } from "@/components/ui/inputs";
import { Badge, EmptyState, Table, TBody, TD, TH, THead, TR } from "@/components/ui/primitives";
import { formatCurrency, formatDateTime, formatNumber } from "@/lib/format";
import { FLUID_KIND, FUEL_REVIEW, FUEL_SOURCE } from "@/lib/labels";
import type { AuthContext } from "@/server/authz/context";
import type { listFuelEntries } from "@/server/services/fuel";
import { T, Tr } from "@/i18n/client";

type Entry = Awaited<ReturnType<typeof listFuelEntries>>["items"][number];

/**
 * Pleins et appoints : produit, quantité, montant, compteur, anomalies. Le responsable du parc justifie une anomalie
 * ou annule un plein erroné (commentaire obligatoire) ; un seul panneau d'actions pour la liste.
 */
export function FuelEntriesTable({
  items,
  ctx,
  showEquipment = false,
  emptyText = "Aucun plein enregistré.",
}: {
  items: Entry[];
  ctx: AuthContext;
  showEquipment?: boolean;
  emptyText?: string;
}) {
  return (
    <ActionPanel action={reviewFuelAction} className="[&>[role]]:mx-5 [&>[role]]:mt-4">
      {items.length === 0 ? (
        <EmptyState title={emptyText} />
      ) : (
        <Table>
          <THead>
            <tr>
              <TH>
                <T>Date</T>
              </TH>
              {showEquipment ? (
                <TH>
                  <T>Équipement</T>
                </TH>
              ) : null}
              <TH>
                <T>Produit</T>
              </TH>
              <TH className="text-end">
                <T>Quantité</T>
              </TH>
              <TH className="text-end">
                <T>Montant</T>
              </TH>
              <TH className="text-end">
                <T>Compteur</T>
              </TH>
              <TH>
                <T>Examen</T>
              </TH>
            </tr>
          </THead>
          <TBody>
            {items.map((e) => {
              const canReview = e.status === "VALID" && ctx.canOn("fuel.manage", e);
              return (
                <TR key={e.id} className={e.status === "CANCELLED" ? "opacity-60" : undefined}>
                  <TD className="whitespace-nowrap">
                    {formatDateTime(e.filledAt)}
                    <p className="text-xs text-slate-500">
                      <Tr>{FUEL_SOURCE[e.source] ?? e.source}</Tr>
                      {e.cardLast4 ? ` · ${e.cardProvider} …${e.cardLast4}` : ""}
                      {e.station ? ` · ${e.station}` : ""}
                    </p>
                  </TD>
                  {showEquipment ? (
                    <TD>
                      <Link href={`/equipements/${e.equipmentId}`} className="font-medium text-brand-700 hover:underline">
                        {e.equipmentCode}
                      </Link>
                      <p className="max-w-48 truncate text-xs text-slate-500">{e.equipmentName}</p>
                    </TD>
                  ) : null}
                  <TD>
                    <Tr>{FLUID_KIND[e.fluid] ?? e.fluid}</Tr>
                    {e.fullTank ? null : (
                      <p className="text-xs text-slate-500">
                        <T>Appoint</T>
                      </p>
                    )}
                  </TD>
                  <TD className="text-end tabular-nums">{formatNumber(e.quantity, "L")}</TD>
                  <TD className="text-end tabular-nums">{e.amount != null ? formatCurrency(e.amount) : "—"}</TD>
                  <TD className="text-end tabular-nums">{e.meterValue != null ? formatNumber(e.meterValue, e.meterUnit ?? "") : "—"}</TD>
                  <TD className="min-w-56">
                    {e.status === "CANCELLED" ? (
                      <>
                        <Badge tone="gray">
                          <T>Annulé</T>
                        </Badge>
                        {e.cancelReason ? <p className="mt-1 text-xs text-slate-500">{e.cancelReason}</p> : null}
                      </>
                    ) : (
                      <Badge tone={FUEL_REVIEW[e.reviewStatus]?.tone}>
                        <Tr>{FUEL_REVIEW[e.reviewStatus]?.label ?? e.reviewStatus}</Tr>
                      </Badge>
                    )}
                    {e.anomalies.length > 0 ? (
                      <ul className="mt-1 list-disc space-y-0.5 ps-4 text-xs text-amber-800">
                        {e.anomalies.map((a) => (
                          <li key={a.code}>
                            <Tr>{a.message}</Tr>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                    {e.reviewComment ? <p className="mt-1 text-xs text-slate-500">{e.reviewComment}</p> : null}
                    {canReview ? (
                      <Disclosure summary={e.reviewStatus === "TO_REVIEW" ? "Examiner" : "Annuler le plein"} className="mt-2">
                        <PanelForm className="space-y-2">
                          <input type="hidden" name="entryId" value={e.id} />
                          <Field label="Décision" name="decision" required>
                            <Select
                              name="decision"
                              required
                              defaultValue={e.reviewStatus === "TO_REVIEW" ? "JUSTIFIED" : "CANCELLED"}
                              options={[
                                ...(e.reviewStatus === "TO_REVIEW" ? [{ value: "JUSTIFIED", label: "Anomalie justifiée" }] : []),
                                { value: "CANCELLED", label: "Plein erroné : l'annuler" },
                              ]}
                            />
                          </Field>
                          <Field label="Commentaire" name="comment" required>
                            <Input name="comment" required maxLength={500} />
                          </Field>
                          <SubmitButton size="sm">
                            <T>Enregistrer la décision</T>
                          </SubmitButton>
                        </PanelForm>
                      </Disclosure>
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
