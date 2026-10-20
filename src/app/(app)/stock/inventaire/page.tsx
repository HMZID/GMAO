import { Forbidden } from "@/components/forbidden";
import { ActionForm, ActionPanel, Field, PanelForm, SubmitButton } from "@/components/forms/action-form";
import { PageHeader } from "@/components/layout/page-header";
import { Input, Select, Textarea } from "@/components/ui/inputs";
import { Badge, Card, CardBody, CardHeader, EmptyState, Table, TBody, TD, TH, THead, TR } from "@/components/ui/primitives";
import { formatCurrency, formatDateTime, formatNumber, toDateTimeInput } from "@/lib/format";
import { INVENTORY_COUNT_STATUS } from "@/lib/labels";
import { getAuthContext } from "@/server/auth/session";
import { INVENTORY_VALIDATION_THRESHOLD, inventoryValue } from "@/server/domain/stock";
import { listInventoryCounts } from "@/server/services/inventory";
import { listWarehouses } from "@/server/services/organization";
import { listPartOptions } from "@/server/services/stock";
import { inventoryCountAction, inventoryDecisionAction } from "../actions";
import { T, Tr } from "@/i18n/client";
import { tpl } from "@/i18n/translate";

export const metadata = { title: "Inventaire" };

/** Inventaire (STK-07) : comptage, écart calculé à l'heure du comptage, validation au-delà du seuil. */
export default async function InventoryPage() {
  const ctx = await getAuthContext();
  if (!ctx.can("stock.read")) return <Forbidden what="l'inventaire" />;
  const now = new Date();
  const canCount = ctx.can("inventory.adjust");
  const [counts, parts, warehouses] = await Promise.all([
    listInventoryCounts(ctx),
    canCount ? listPartOptions(ctx) : Promise.resolve([]),
    canCount ? listWarehouses(ctx) : Promise.resolve([]),
  ]);
  const pending = counts.filter((c) => c.status === "PENDING");
  const decidable = (c: (typeof counts)[number]) =>
    ctx.canOn("inventory.validate", { companyId: c.companyId, siteId: c.siteId }) && c.createdById !== ctx.userId;

  return (
    <>
      <PageHeader
        back={{ href: "/stock", label: "Pièces et stocks" }}
        title="Inventaire"
        description={tpl`L'écart est calculé sur le stock théorique à l'heure du comptage : une sortie faite pendant l'inventaire reste enregistrée à part. Au-delà de ${formatCurrency(INVENTORY_VALIDATION_THRESHOLD)} d'écart, il attend la validation du responsable et ne modifie pas le stock.`}
      />

      {canCount ? (
        <Card className="mb-6">
          <CardHeader title="Nouveau comptage" />
          <CardBody>
            <ActionForm action={inventoryCountAction} resetOnSuccess className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Field label="Magasin" name="warehouseId" required>
                <Select
                  name="warehouseId"
                  required
                  placeholder="Choisir…"
                  options={warehouses.map((w) => ({ value: w.id, label: `${w.name} — ${w.siteName}` }))}
                />
              </Field>
              <Field label="Article" name="partId" required className="lg:col-span-2">
                <Select
                  name="partId"
                  required
                  placeholder="Choisir…"
                  options={parts.map((p) => ({ value: p.id, label: `${p.sku} — ${p.name} (${p.unit})` }))}
                />
              </Field>
              <Field label="Quantité comptée" name="countedQuantity" required>
                <Input name="countedQuantity" type="number" min={0} step="any" required />
              </Field>
              <Field label="Compté le" name="countedAt" hint="Heure du comptage (par défaut : maintenant)">
                <Input name="countedAt" type="datetime-local" defaultValue={toDateTimeInput(now)} />
              </Field>
              <Field label="Commentaire" name="comment">
                <Input name="comment" maxLength={500} />
              </Field>
              <div className="sm:col-span-2 lg:col-span-3">
                <SubmitButton>
                  <T>Enregistrer le comptage</T>
                </SubmitButton>
              </div>
            </ActionForm>
          </CardBody>
        </Card>
      ) : null}

      <Card className="mb-6">
        <CardHeader
          title={tpl`Écarts à valider (${pending.length})`}
          description="Le stock ne change qu'à la validation ; la personne qui a compté ne valide pas son propre écart."
        />
        <ActionPanel action={inventoryDecisionAction} className="[&>[role]]:mx-5 [&>[role]]:mt-4">
          {pending.length === 0 ? (
            <EmptyState title="Aucun écart à valider" />
          ) : (
            <ul className="divide-y divide-slate-100">
              {pending.map((c) => (
                <li key={c.id} className="grid gap-4 px-5 py-4 lg:grid-cols-[1fr_22rem]">
                  <div className="space-y-1 text-sm">
                    <p className="font-medium text-slate-900">
                      <Tr>{c.sku}</Tr> — <Tr>{c.partName}</Tr> · <Tr>{c.warehouseName}</Tr>
                    </p>
                    <p className="text-slate-600">
                      <T
                        params={{
                          n: formatNumber(c.countedQuantity),
                          unit: c.unit,
                          n2: formatNumber(c.expectedQuantity),
                          date: formatDateTime(c.countedAt),
                          v: c.countedByName ?? "—",
                        }}
                      >
                        {"Compté {n} {unit} pour {n2} attendu(s) le {date} par {v}"}
                      </T>
                    </p>
                    <p className="font-semibold tabular-nums text-slate-900">
                      <T
                        params={{
                          sign: c.difference > 0 ? "+" : "",
                          n: formatNumber(c.difference),
                          unit: c.unit,
                          amount: formatCurrency(inventoryValue(c.difference, c.unitCost)),
                        }}
                      >
                        {"Écart {sign}{n} {unit} · {amount}"}
                      </T>
                    </p>
                    {c.comment ? (
                      <p className="text-slate-500">
                        <Tr>{c.comment}</Tr>
                      </p>
                    ) : null}
                  </div>
                  {decidable(c) ? (
                    <PanelForm className="space-y-2">
                      <input type="hidden" name="countId" value={c.id} />
                      <Field label="Commentaire" name="comment" hint="Obligatoire en cas de refus">
                        <Textarea name="comment" rows={2} maxLength={500} />
                      </Field>
                      <div className="flex gap-2">
                        <SubmitButton name="decision" value="APPROVE" size="sm">
                          <T>Valider l&apos;écart</T>
                        </SubmitButton>
                        <SubmitButton name="decision" value="REJECT" variant="danger" size="sm">
                          <T>Refuser</T>
                        </SubmitButton>
                      </div>
                    </PanelForm>
                  ) : (
                    <p className="text-sm text-slate-500">
                      <T>En attente de la validation du responsable maintenance.</T>
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </ActionPanel>
      </Card>

      <Card>
        <CardHeader title="Derniers comptages" description="100 derniers, dans votre périmètre" />
        {counts.length === 0 ? (
          <EmptyState title="Aucun comptage" />
        ) : (
          <Table>
            <THead>
              <tr>
                <TH>
                  <T>Article</T>
                </TH>
                <TH>
                  <T>Magasin</T>
                </TH>
                <TH>
                  <T>Compté le</T>
                </TH>
                <TH className="text-end">
                  <T>Compté</T>
                </TH>
                <TH className="text-end">
                  <T>Attendu</T>
                </TH>
                <TH className="text-end">
                  <T>Écart</T>
                </TH>
                <TH>
                  <T>Statut</T>
                </TH>
              </tr>
            </THead>
            <TBody>
              {counts.map((c) => (
                <TR key={c.id}>
                  <TD>
                    <p className="font-medium text-slate-900">
                      <Tr>{c.sku}</Tr>
                    </p>
                    <p className="text-xs text-slate-500">
                      <Tr>{c.partName}</Tr>
                    </p>
                  </TD>
                  <TD>
                    <Tr>{c.warehouseName}</Tr>
                  </TD>
                  <TD>
                    {formatDateTime(c.countedAt)}
                    <p className="text-xs text-slate-500">{c.countedByName ?? "—"}</p>
                  </TD>
                  <TD className="text-end tabular-nums">{formatNumber(c.countedQuantity)}</TD>
                  <TD className="text-end tabular-nums">{formatNumber(c.expectedQuantity)}</TD>
                  <TD className="text-end tabular-nums">
                    {c.difference > 0 ? "+" : ""}
                    {formatNumber(c.difference)}
                  </TD>
                  <TD>
                    <Badge tone={INVENTORY_COUNT_STATUS[c.status]?.tone}>
                      <Tr>{INVENTORY_COUNT_STATUS[c.status]?.label ?? c.status}</Tr>
                    </Badge>
                    {c.decidedByName && c.status !== "PENDING" ? (
                      <p className="text-xs text-slate-500">
                        <Tr>{c.decidedByName}</Tr>
                      </p>
                    ) : null}
                    {c.decisionComment ? (
                      <p className="text-xs text-slate-500">
                        <Tr>{c.decisionComment}</Tr>
                      </p>
                    ) : null}
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </Card>
    </>
  );
}
