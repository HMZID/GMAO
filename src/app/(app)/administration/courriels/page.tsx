import Link from "next/link";
import { Forbidden } from "@/components/forbidden";
import { ActionForm, ActionPanel, PanelForm, SubmitButton } from "@/components/forms/action-form";
import { PageHeader } from "@/components/layout/page-header";
import { Badge, Card, EmptyState, StatTile, Table, TBody, TD, TH, THead, TR } from "@/components/ui/primitives";
import { formatDateTime } from "@/lib/format";
import { EMAIL_STATUS } from "@/lib/labels";
import { getAuthContext } from "@/server/auth/session";
import { EMAIL_EVENT_DEFINITIONS } from "@/server/domain/email";
import { cleanFilters, queryParams } from "@/server/pages";
import { listOutbox, outboxFilters } from "@/server/services/email";
import { emailActionAction, runEmailJobsAction } from "./actions";
import { T, Tr } from "@/i18n/client";

export const metadata = { title: "Courriels" };

export default async function EmailsPage(props: PageProps<"/administration/courriels">) {
  const ctx = await getAuthContext();
  if (!ctx.can("settings.manage")) return <Forbidden what="le suivi des courriels" />;
  const params = cleanFilters(outboxFilters, queryParams(await props.searchParams));
  const { items, stats } = await listOutbox(ctx, params);
  const filter = (status?: string) => (status ? `/administration/courriels?status=${status}` : "/administration/courriels");

  return (
    <>
      <PageHeader
        back={{ href: "/administration", label: "Administration" }}
        title="Courriels"
        description="File d'envoi des notifications par courriel : chaque envoi est tenté par le processus d'envoi (npm run worker), repris en cas d'erreur passagère, puis mis en échec après 5 tentatives."
        actions={
          <ActionForm action={runEmailJobsAction} className="max-w-md text-end">
            <SubmitButton variant="secondary">
              <T>Traiter la file maintenant</T>
            </SubmitButton>
          </ActionForm>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="En attente" value={stats.PENDING ?? 0} tone="blue" href={filter("PENDING")} />
        <StatTile label="Envoyés" value={stats.SENT ?? 0} tone="green" href={filter("SENT")} />
        <StatTile label="En échec" value={stats.FAILED ?? 0} tone={stats.FAILED ? "red" : "gray"} href={filter("FAILED")} />
        <StatTile label="Annulés" value={stats.CANCELLED ?? 0} href={filter("CANCELLED")} />
      </div>

      <Card>
        <div className="flex items-center justify-between px-5 py-3 text-sm">
          <span className="text-slate-600">
            <Tr>{params.status ? `Filtre : ${EMAIL_STATUS[params.status]?.label}` : "200 derniers courriels"}</Tr>
          </span>
          {params.status ? (
            <Link href={filter()} className="text-brand-700 hover:underline">
              <T>Tous les statuts</T>
            </Link>
          ) : null}
        </div>
        <ActionPanel action={emailActionAction} className="[&>[role]]:mx-5">
          {items.length === 0 ? (
            <EmptyState title="Aucun courriel" />
          ) : (
            <Table>
              <THead>
                <tr>
                  <TH>
                    <T>Courriel</T>
                  </TH>
                  <TH>
                    <T>Destinataire</T>
                  </TH>
                  <TH>
                    <T>Statut</T>
                  </TH>
                  <TH>
                    <T>Tentatives</T>
                  </TH>
                  <TH className="sr-only">
                    <T>Actions</T>
                  </TH>
                </tr>
              </THead>
              <TBody>
                {items.map((m) => (
                  <TR key={m.id}>
                    <TD>
                      <p className="font-medium text-slate-900">{m.subject}</p>
                      <p className="text-xs text-slate-500">
                        <T
                          params={{
                            label: EMAIL_EVENT_DEFINITIONS[m.event].label,
                            date: formatDateTime(m.createdAt),
                            v: m.sentAt
                              ? ` · envoyé le ${formatDateTime(m.sentAt)}${m.transport === "log" ? " (journal, sans envoi réel)" : ""}`
                              : "",
                          }}
                        >
                          {"{label} · créé le {date}{v}"}
                        </T>
                      </p>
                      {m.lastError ? (
                        <p className="mt-1 text-xs text-red-700">
                          <T params={{ lastError: m.lastError }}>{"Dernière erreur : {lastError}"}</T>
                        </p>
                      ) : null}
                    </TD>
                    <TD>{m.toAddress}</TD>
                    <TD>
                      <Badge tone={EMAIL_STATUS[m.status]?.tone}>{EMAIL_STATUS[m.status]?.label}</Badge>
                      {m.status === "PENDING" && m.attempts > 0 ? (
                        <p className="mt-1 text-xs text-slate-500">
                          <T params={{ date: formatDateTime(m.nextAttemptAt) }}>{"Nouvel essai le {date}"}</T>
                        </p>
                      ) : null}
                    </TD>
                    <TD className="tabular-nums">{m.attempts}</TD>
                    <TD className="text-end">
                      {m.status === "FAILED" || m.status === "CANCELLED" ? (
                        <PanelForm>
                          <input type="hidden" name="id" value={m.id} />
                          <input type="hidden" name="op" value="retry" />
                          <SubmitButton variant="ghost" size="sm">
                            <T>Relancer</T>
                          </SubmitButton>
                        </PanelForm>
                      ) : m.status === "PENDING" ? (
                        <PanelForm>
                          <input type="hidden" name="id" value={m.id} />
                          <input type="hidden" name="op" value="cancel" />
                          <SubmitButton variant="ghost" size="sm">
                            <T>Annuler</T>
                          </SubmitButton>
                        </PanelForm>
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
