import Link from "next/link";
import { ActionForm, SubmitButton } from "@/components/forms/action-form";
import { PageHeader } from "@/components/layout/page-header";
import { CriticalityBadge } from "@/components/status-badges";
import { ButtonLink } from "@/components/ui/button";
import { Input } from "@/components/ui/inputs";
import { Badge, Card, CardBody, CardHeader, DescriptionList, EmptyState, Table, TBody, TD, TH, THead, TR } from "@/components/ui/primitives";
import { formatCurrency, formatDateTime, formatNumber } from "@/lib/format";
import { MOVEMENT_TYPE, PART_TRACKING } from "@/lib/labels";
import { getAuthContext } from "@/server/auth/session";
import { loadOr404 } from "@/server/pages";
import { getPart } from "@/server/services/stock";
import { stockLevelSettingsAction } from "../../actions";
import { T, Tr } from "@/i18n/client";
import { tpl } from "@/i18n/translate";

export const metadata = { title: "Article" };

export default async function PartPage(props: PageProps<"/stock/articles/[id]">) {
  const { id } = await props.params;
  const ctx = await getAuthContext();
  const part = await loadOr404(id, (x) => getPart(ctx, x));
  const canSettings = ctx.can("part.write");
  const canMove = ctx.can("stock.move") || ctx.can("inventory.adjust");
  const total = part.levels.reduce((s, l) => s + l.onHand, 0);

  return (
    <>
      <PageHeader
        back={{ href: "/stock", label: "Pièces et stocks" }}
        title={`${part.sku} — ${part.name}`}
        meta={
          <>
            <CriticalityBadge value={part.criticality} />
            {part.family ? (
              <Badge>
                <Tr>{part.family}</Tr>
              </Badge>
            ) : null}
            {part.isRepairable ? (
              <Badge tone="violet">
                <T>Réparable</T>
              </Badge>
            ) : null}
            {!part.active ? (
              <Badge tone="amber">
                <T>Inactif</T>
              </Badge>
            ) : null}
          </>
        }
        actions={
          canMove ? (
            <ButtonLink href={`/stock/mouvements?partId=${part.id}`}>
              <T>Nouveau mouvement</T>
            </ButtonLink>
          ) : null
        }
      />
      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <Card>
            <CardHeader
              title="Stock par magasin"
              description={tpl`Total : ${formatNumber(total, part.unit)} — valeur ${formatCurrency(total * part.averageCost)}`}
            />
            {part.levels.length === 0 ? (
              <EmptyState title="Aucun stock dans votre périmètre" />
            ) : (
              <Table>
                <THead>
                  <tr>
                    <TH>
                      <T>Magasin</T>
                    </TH>
                    <TH className="text-end">
                      <T>En stock</T>
                    </TH>
                    <TH className="text-end">
                      <T>Réservé</T>
                    </TH>
                    <TH className="text-end">
                      <T>Disponible</T>
                    </TH>
                    <TH>
                      <T>Seuils (mini · point de commande · maxi)</T>
                    </TH>
                  </tr>
                </THead>
                <TBody>
                  {part.levels.map((l) => {
                    const free = l.onHand - l.reserved;
                    const below = l.reorderPoint !== null && free <= l.reorderPoint;
                    return (
                      <TR key={l.id}>
                        <TD>
                          <Tr>{l.warehouseName}</Tr>
                          <p className="text-xs text-slate-500">
                            <Tr>{l.siteName}</Tr>
                          </p>
                        </TD>
                        <TD className="text-end tabular-nums">{formatNumber(l.onHand)}</TD>
                        <TD className="text-end tabular-nums text-slate-500">{formatNumber(l.reserved)}</TD>
                        <TD className="text-end tabular-nums">
                          {formatNumber(free)}
                          {below ? (
                            <Badge tone="amber" className="ms-2">
                              <T>À commander</T>
                            </Badge>
                          ) : null}
                        </TD>
                        <TD>
                          {canSettings ? (
                            <ActionForm action={stockLevelSettingsAction.bind(null, l.id)} className="flex flex-wrap items-center gap-1.5">
                              <Input
                                name="minQty"
                                type="number"
                                min={0}
                                step="any"
                                defaultValue={l.minQty ?? ""}
                                className="h-8 w-16"
                                aria-label="Stock mini"
                              />
                              <Input
                                name="reorderPoint"
                                type="number"
                                min={0}
                                step="any"
                                defaultValue={l.reorderPoint ?? ""}
                                className="h-8 w-16"
                                aria-label="Point de commande"
                              />
                              <Input
                                name="maxQty"
                                type="number"
                                min={0}
                                step="any"
                                defaultValue={l.maxQty ?? ""}
                                className="h-8 w-16"
                                aria-label="Stock maxi"
                              />
                              <SubmitButton size="sm" variant="ghost">
                                OK
                              </SubmitButton>
                            </ActionForm>
                          ) : (
                            <span className="text-sm tabular-nums text-slate-600">
                              {formatNumber(l.minQty)} · {formatNumber(l.reorderPoint)} · {formatNumber(l.maxQty)}
                            </span>
                          )}
                        </TD>
                      </TR>
                    );
                  })}
                </TBody>
              </Table>
            )}
          </Card>
          <Card>
            <CardHeader
              title="Derniers mouvements"
              actions={
                <Link href={`/stock/mouvements?partId=${part.id}`} className="text-sm text-brand-700 hover:underline">
                  <T>Tous les mouvements</T>
                </Link>
              }
            />
            {part.movements.length === 0 ? (
              <EmptyState title="Aucun mouvement" />
            ) : (
              <Table>
                <THead>
                  <tr>
                    <TH>
                      <T>Date</T>
                    </TH>
                    <TH>
                      <T>Mouvement</T>
                    </TH>
                    <TH>
                      <T>Magasin</T>
                    </TH>
                    <TH className="text-end">
                      <T>Quantité</T>
                    </TH>
                    <TH>
                      <T>Référence</T>
                    </TH>
                  </tr>
                </THead>
                <TBody>
                  {part.movements.map((m) => (
                    <TR key={m.id}>
                      <TD className="whitespace-nowrap">{formatDateTime(m.createdAt)}</TD>
                      <TD>
                        <Tr>{MOVEMENT_TYPE[m.type]?.label ?? m.type}</Tr>
                      </TD>
                      <TD>
                        <Tr>{m.warehouseName}</Tr>
                      </TD>
                      <TD className="text-end tabular-nums">{signed(m.type, m.quantity)}</TD>
                      <TD className="text-xs text-slate-600">
                        {m.workOrderId ? (
                          <Link href={`/interventions/${m.workOrderId}`} className="text-brand-700 hover:underline">
                            <Tr>{m.workOrderNumber}</Tr>
                          </Link>
                        ) : (
                          [m.reference, m.reason].filter(Boolean).join(" — ")
                        )}
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            )}
          </Card>
        </div>
        <Card>
          <CardHeader title="Article" />
          <CardBody>
            <DescriptionList
              columns={1}
              items={[
                { label: "Fabricant", value: part.manufacturer },
                { label: "Référence fabricant", value: part.manufacturerRef },
                { label: "Unité", value: part.unit },
                { label: "Suivi", value: PART_TRACKING[part.tracking] ?? part.tracking },
                { label: "Coût moyen pondéré", value: formatCurrency(part.averageCost) },
              ]}
            />
          </CardBody>
        </Card>
      </div>
    </>
  );
}

function signed(type: string, quantity: number) {
  const sign = MOVEMENT_TYPE[type]?.sign ?? 0;
  if (sign === 0) return quantity > 0 ? `+${formatNumber(quantity)}` : formatNumber(quantity);
  return `${sign > 0 ? "+" : "−"}${formatNumber(quantity)}`;
}
