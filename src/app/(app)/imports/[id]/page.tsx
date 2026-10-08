import { Download } from "lucide-react";
import Link from "next/link";
import { ActionPanel, PanelForm, SubmitButton } from "@/components/forms/action-form";
import { PageHeader } from "@/components/layout/page-header";
import { buttonClass } from "@/components/ui/button";
import { Alert, Badge, Card, CardBody, CardHeader, EmptyState, StatTile, Table, TBody, TD, TH, THead, TR } from "@/components/ui/primitives";
import { formatDate, formatDateTime, formatNumber } from "@/lib/format";
import { IMPORT_KIND, IMPORT_MODE, IMPORT_ROW_STATUS, IMPORT_STATUS } from "@/lib/labels";
import { getAuthContext } from "@/server/auth/session";
import { IMPORT_DEFINITIONS, type ImportColumn } from "@/server/domain/imports";
import { loadOr404 } from "@/server/pages";
import { getImportJob } from "@/server/services/imports";
import { executeImportAction } from "../actions";

export const metadata = { title: "Import" };

/** Lignes affichées à l'écran ; le rapport Excel contient toutes les lignes. */
const DISPLAY_LIMIT = 500;

function display(value: unknown, column: ImportColumn) {
  if (value === undefined || value === null || value === "") return "—";
  if (column.type === "date") return formatDate(new Date(String(value)));
  if (column.type === "boolean") return value ? "Oui" : "Non";
  if (column.choices) return Object.entries(column.choices).find(([, v]) => v === value)?.[0] ?? String(value);
  if (typeof value === "number") return formatNumber(value);
  return String(value);
}

export default async function ImportPage(props: PageProps<"/imports/[id]">) {
  const { id } = await props.params;
  const { vue } = await props.searchParams;
  const ctx = await getAuthContext();
  const job = await loadOr404(id, (x) => getImportJob(ctx, x));
  const definition = IMPORT_DEFINITIONS[job.kind];
  // Aperçu : les colonnes clés, le reste est dans le rapport Excel.
  const preview = definition.columns.slice(0, 5);
  const onlyIssues = vue === "anomalies";
  const rows = onlyIssues ? job.rows.filter((r) => r.status === "ERROR") : job.rows;
  const s = job.summary;

  return (
    <>
      <PageHeader
        back={{ href: "/imports", label: "Imports" }}
        title={job.fileName}
        meta={
          <>
            <Badge tone={IMPORT_STATUS[job.status]?.tone}>{IMPORT_STATUS[job.status]?.label ?? job.status}</Badge>
            <Badge>{IMPORT_KIND[job.kind]}</Badge>
            <span className="text-sm text-slate-500">
              {job.author} · simulé le {formatDateTime(job.createdAt)}
              {job.executedAt ? ` · exécuté le ${formatDateTime(job.executedAt)} (${IMPORT_MODE[job.mode ?? ""] ?? ""})` : ""}
            </span>
          </>
        }
        actions={
          <a href={`/api/v1/imports/${job.id}/report`} className={buttonClass("secondary")}>
            <Download className="h-4 w-4" aria-hidden />
            Rapport Excel
          </a>
        }
      />

      {job.fileErrors.length > 0 ? (
        <div className="mb-6">
          <Alert tone="red" title="Fichier refusé">
            <ul className="list-disc pl-5">
              {job.fileErrors.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          </Alert>
        </div>
      ) : null}
      {job.alreadyImported && job.status === "SIMULATED" ? (
        <div className="mb-6">
          <Alert tone="amber" title="Fichier déjà importé">
            Ce même fichier a été exécuté le {formatDateTime(job.alreadyImported.executedAt)}. Les lignes déjà présentes sont ignorées : aucun doublon
            ne sera créé.
          </Alert>
        </div>
      ) : null}

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatTile label="Lignes lues" value={s.total} />
        <StatTile label="À importer" value={s.ready} tone="blue" />
        <StatTile label="Déjà présentes" value={s.exists} hint="Ignorées (réimportation)" />
        <StatTile label="En erreur" value={s.errors} tone={s.errors ? "red" : "gray"} hint={s.errors ? "À corriger dans le fichier" : undefined} />
        <StatTile label="Importées" value={s.imported} tone={s.imported ? "green" : "gray"} />
      </div>

      {/* La carte reste affichée après l'exécution : le message de résultat du panneau reste visible. */}
      {job.fileErrors.length === 0 ? (
        <Card className="mb-6">
          <CardHeader
            title={job.status === "SIMULATED" ? "Exécuter l'import" : "Exécution"}
            description="Les lignes prêtes sont recontrôlées puis créées une à une, avec les mêmes règles qu'à l'écran. Les lignes déjà présentes ne sont jamais recréées."
          />
          <CardBody>
            <ActionPanel action={executeImportAction.bind(null, job.id)} className="flex flex-wrap items-start gap-3 [&>[role]]:w-full">
              {job.status !== "SIMULATED" ? (
                <p className="text-sm text-slate-600">
                  {job.executedAt
                    ? `Exécuté le ${formatDateTime(job.executedAt)} (${IMPORT_MODE[job.mode ?? ""] ?? ""}) : ${s.imported} ligne(s) créée(s).`
                    : "Exécution en cours."}
                </p>
              ) : null}
              {job.status === "SIMULATED" ? (
                <PanelForm>
                  <input type="hidden" name="mode" value="ALL_OR_NOTHING" />
                  <SubmitButton>Tout importer ({s.ready})</SubmitButton>
                  <p className="mt-1 max-w-xs text-xs text-slate-500">Tout ou rien : refusé tant qu&apos;une ligne est en erreur.</p>
                </PanelForm>
              ) : null}
              {job.status === "SIMULATED" && s.errors > 0 ? (
                <PanelForm>
                  <input type="hidden" name="mode" value="VALID_ONLY" />
                  <SubmitButton variant="secondary">Importer les lignes valides ({s.ready})</SubmitButton>
                  <p className="mt-1 max-w-xs text-xs text-slate-500">Les {s.errors} ligne(s) en erreur restent à corriger et à réimporter.</p>
                </PanelForm>
              ) : null}
            </ActionPanel>
          </CardBody>
        </Card>
      ) : null}

      <Card>
        <CardHeader
          title="Aperçu ligne par ligne"
          description={rows.length > DISPLAY_LIMIT ? `${DISPLAY_LIMIT} premières lignes ; toutes les lignes sont dans le rapport Excel.` : undefined}
          actions={
            <Link href={onlyIssues ? `/imports/${job.id}` : `/imports/${job.id}?vue=anomalies`} className="text-sm text-brand-700 hover:underline">
              {onlyIssues ? "Toutes les lignes" : "Lignes en erreur seulement"}
            </Link>
          }
        />
        {rows.length === 0 ? (
          <EmptyState title={onlyIssues ? "Aucune ligne en erreur" : "Aucune ligne"} />
        ) : (
          <Table>
            <THead>
              <tr>
                <TH>Ligne</TH>
                <TH>Statut</TH>
                {preview.map((c) => (
                  <TH key={c.key}>{c.label}</TH>
                ))}
                <TH>Anomalies</TH>
              </tr>
            </THead>
            <TBody>
              {rows.slice(0, DISPLAY_LIMIT).map((r) => (
                <TR key={r.line}>
                  <TD className="tabular-nums">{r.line}</TD>
                  <TD>
                    <Badge tone={IMPORT_ROW_STATUS[r.status]?.tone}>{IMPORT_ROW_STATUS[r.status]?.label ?? r.status}</Badge>
                  </TD>
                  {preview.map((c) => (
                    <TD key={c.key} className="whitespace-nowrap">
                      {display(r.values[c.key], c)}
                    </TD>
                  ))}
                  <TD className="min-w-72">
                    {r.messages.length > 0 ? (
                      <ul className={`list-disc space-y-0.5 pl-4 text-xs ${r.status === "ERROR" ? "text-red-800" : "text-slate-600"}`}>
                        {r.messages.map((m) => (
                          <li key={m}>{m}</li>
                        ))}
                      </ul>
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
