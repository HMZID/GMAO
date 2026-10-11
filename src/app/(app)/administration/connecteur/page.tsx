import Link from "next/link";
import type { ReactNode } from "react";
import { Forbidden } from "@/components/forbidden";
import { ActionForm, Field, SubmitButton } from "@/components/forms/action-form";
import { PageHeader } from "@/components/layout/page-header";
import { Disclosure } from "@/components/ui/disclosure";
import { Input, Select } from "@/components/ui/inputs";
import { Alert, Badge, Card, CardBody, CardHeader, EmptyState, Table, TBody, TD, TH, THead, TR } from "@/components/ui/primitives";
import { formatDate, formatDateTime } from "@/lib/format";
import { getAuthContext } from "@/server/auth/session";
import { API_KEY_ACCESS, API_KEY_ACCESS_LABEL, type ApiKeyAccess } from "@/server/domain/api-keys";
import { publicUrl } from "@/server/public-url";
import { listApiKeys } from "@/server/services/api-keys";
import { createApiKeyAction, revokeApiKeyAction } from "../actions";

export const metadata = { title: "Connecteur de l'organisation" };

const STATE = {
  ACTIVE: { label: "Active", tone: "green" },
  REVOKED: { label: "Révoquée", tone: "gray" },
  EXPIRED: { label: "Expirée", tone: "amber" },
} as const;

/** Connecteur de l'organisation (INT-01, INT-05) : clés d'API pour un ETL ou une intégration, et mode d'emploi. */
export default async function ConnectorPage() {
  const ctx = await getAuthContext();
  if (!ctx.can("settings.manage")) return <Forbidden what="le connecteur de l'organisation" />;
  const keys = await listApiKeys(ctx);
  const base = publicUrl().replace(/\/$/, "");

  return (
    <>
      <PageHeader
        back={{ href: "/administration", label: "Administration" }}
        title="Connecteur de l'organisation (API et ETL)"
        description="Clés d'API pour brancher un ETL, un outil de pilotage ou un autre logiciel : export des données, extraction incrémentale et imports, avec les mêmes contrôles que l'application."
      />

      <Card className="mb-6">
        <CardHeader title="Clés d'API" description="Une clé par outil ou par flux : on peut la révoquer sans gêner les autres." />
        <CardBody className="border-b border-slate-100">
          <Disclosure summary="Nouvelle clé">
            <ActionForm action={createApiKeyAction} resetOnSuccess className="grid gap-3 sm:grid-cols-3">
              <Field label="Nom" name="name" required hint="Outil ou flux qui l'utilise">
                <Input name="name" required maxLength={80} placeholder="Ex. : ETL entrepôt de données" />
              </Field>
              <Field label="Accès" name="access" required>
                <Select
                  name="access"
                  required
                  defaultValue="READ"
                  options={API_KEY_ACCESS.map((a) => ({ value: a, label: API_KEY_ACCESS_LABEL[a] }))}
                />
              </Field>
              <Field label="Validité" name="durationDays">
                <Select
                  name="durationDays"
                  defaultValue="365"
                  placeholder="Sans échéance"
                  options={[
                    { value: "30", label: "30 jours" },
                    { value: "90", label: "90 jours" },
                    { value: "365", label: "1 an" },
                  ]}
                />
              </Field>
              <div className="sm:col-span-3">
                <SubmitButton>Créer la clé</SubmitButton>
              </div>
            </ActionForm>
          </Disclosure>
        </CardBody>
        {keys.length === 0 ? (
          <EmptyState title="Aucune clé" description="Créer une clé pour brancher un premier outil." />
        ) : (
          <Table>
            <THead>
              <tr>
                <TH>Clé</TH>
                <TH>Accès</TH>
                <TH>Créée</TH>
                <TH>Dernière utilisation</TH>
                <TH>Échéance</TH>
                <TH>État</TH>
                <TH className="sr-only">Actions</TH>
              </tr>
            </THead>
            <TBody>
              {keys.map((k) => (
                <TR key={k.id}>
                  <TD>
                    <p className="font-medium text-slate-900">{k.name}</p>
                    <p className="font-mono text-xs text-slate-500">{k.prefix}…</p>
                  </TD>
                  <TD>{API_KEY_ACCESS_LABEL[k.access as ApiKeyAccess] ?? k.access}</TD>
                  <TD className="text-xs">
                    {formatDate(k.createdAt)} par {k.createdBy}
                  </TD>
                  <TD className="text-xs">{k.lastUsedAt ? formatDateTime(k.lastUsedAt) : "Jamais"}</TD>
                  <TD className="text-xs">{k.expiresAt ? formatDate(k.expiresAt) : "Aucune"}</TD>
                  <TD>
                    <Badge tone={STATE[k.state].tone}>{STATE[k.state].label}</Badge>
                  </TD>
                  <TD>
                    {k.state === "ACTIVE" ? (
                      <ActionForm action={revokeApiKeyAction.bind(null, k.id)} showMessage={false}>
                        <SubmitButton size="sm" variant="ghost">
                          Révoquer
                        </SubmitButton>
                      </ActionForm>
                    ) : null}
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </Card>

      <Card>
        <CardHeader
          title="Utiliser le connecteur"
          description="Toutes les requêtes portent la clé dans l'en-tête Authorization (ou X-Api-Key). Réponses JSON, dates ISO 8601 en UTC."
        />
        <CardBody className="space-y-5 text-sm text-slate-700">
          <Step title="Authentification">
            <Code>{`Authorization: Bearer gmk_…`}</Code>
          </Step>
          <Step title="Jeux de données disponibles (nombre de lignes, colonnes, adresses)">
            <Code>{`GET ${base}/api/v1/exports`}</Code>
          </Step>
          <Step title="Extraction incrémentale (ETL) : lignes créées ou modifiées depuis la dernière exécution, par pages">
            <Code>{`GET ${base}/api/v1/exports/work-orders?updatedSince=2026-01-01T00:00:00Z&limit=1000&offset=0`}</Code>
            <p className="mt-1 text-xs text-slate-500">
              Rejouer avec <code>offset=page.next</code> tant que <code>page.next</code> n&apos;est pas nul ; conserver l&apos;heure de début de
              l&apos;extraction comme prochain <code>updatedSince</code>. Jeux de données : equipment, work-orders, work-requests, meter-readings,
              suppliers, technicians, parts, stock-levels, stock-movements.
            </p>
          </Step>
          <Step title="Fichier complet (CSV ou Excel)">
            <Code>{`curl -H "Authorization: Bearer gmk_…" "${base}/api/v1/exports/equipment?format=csv" -o equipements.csv`}</Code>
          </Step>
          <Step title="Import (clé « Lecture, export et import ») : modèle, simulation, exécution, rapport">
            <Code>
              {[
                `GET  ${base}/api/v1/imports/templates/equipment`,
                `POST ${base}/api/v1/imports            (multipart : kind=EQUIPMENT, file=classeur.xlsx)`,
                `POST ${base}/api/v1/imports/{id}/execute  {"mode":"VALID_ONLY"}`,
                `GET  ${base}/api/v1/imports/{id}/report`,
              ].join("\n")}
            </Code>
          </Step>
          <Step title="Indicateurs personnalisés">
            <Code>{`GET ${base}/api/v1/indicators`}</Code>
          </Step>
          <Alert tone="blue">
            Catalogue complet des points d&apos;entrée et de leurs schémas :{" "}
            <Link href="/api/v1" className="font-medium underline">
              /api/v1
            </Link>
            . Une clé ne donne jamais accès au paramétrage ni aux comptes ; ses actions sont tracées au journal d&apos;audit au nom de son créateur
            (canal API). Elle est refusée dès qu&apos;elle est révoquée, expirée, ou si son créateur est désactivé.
          </Alert>
        </CardBody>
      </Card>
    </>
  );
}

function Step({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <p className="mb-1 font-medium text-slate-900">{title}</p>
      {children}
    </div>
  );
}

function Code({ children }: { children: string }) {
  return <pre className="overflow-x-auto rounded-md bg-ink-900 px-3 py-2 font-mono text-xs leading-relaxed text-slate-100">{children}</pre>;
}
