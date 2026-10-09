import { Download } from "lucide-react";
import Link from "next/link";
import { Forbidden } from "@/components/forbidden";
import { ActionForm, Field, SubmitButton } from "@/components/forms/action-form";
import { PageHeader } from "@/components/layout/page-header";
import { buttonClass } from "@/components/ui/button";
import { Input } from "@/components/ui/inputs";
import { Badge, Card, CardBody, CardHeader, EmptyState, Table, TBody, TD, TH, THead, TR } from "@/components/ui/primitives";
import { formatDateTime } from "@/lib/format";
import { IMPORT_KIND, IMPORT_MODE, IMPORT_STATUS } from "@/lib/labels";
import { getAuthContext } from "@/server/auth/session";
import { IMPORT_DEFINITIONS, MAX_IMPORT_ROWS } from "@/server/domain/imports";
import { importableKinds, listImportJobs } from "@/server/services/imports";
import { simulateImportAction } from "./actions";

export const metadata = { title: "Imports" };

const DESCRIPTIONS: Record<string, string> = {
  EQUIPMENT: "Parc d'engins et de véhicules : société, site, catégorie, compteur principal. Les plans d'entretien de la catégorie s'appliquent.",
  PARTS: "Catalogue des pièces détachées : référence interne, marque et référence fabricant, suivi, criticité.",
  INITIAL_STOCK: "Quantités comptées par magasin et seuils de réapprovisionnement. Importer les articles d'abord.",
};

export default async function ImportsPage() {
  const ctx = await getAuthContext();
  const kinds = importableKinds(ctx);
  if (kinds.length === 0) return <Forbidden what="les imports" />;
  const jobs = await listImportJobs(ctx);

  return (
    <>
      <PageHeader
        title="Imports Excel"
        description={`Télécharger le modèle, le remplir, puis lancer la simulation : chaque ligne est contrôlée comme une saisie à l'écran avant tout import (EQP-13, INT-01). ${MAX_IMPORT_ROWS} lignes et 10 Mo au plus par fichier.`}
      />

      <div className="mb-8 grid gap-6 lg:grid-cols-3">
        {kinds.map((kind) => (
          <Card key={kind} className="flex flex-col">
            <CardHeader title={IMPORT_DEFINITIONS[kind].label} description={DESCRIPTIONS[kind]} />
            <CardBody className="flex flex-1 flex-col gap-4">
              <a href={`/api/v1/imports/templates/${kind.toLowerCase()}`} className={buttonClass("secondary", "sm", "self-start")}>
                <Download className="h-4 w-4" aria-hidden />
                Télécharger le modèle
              </a>
              <ActionForm action={simulateImportAction} className="mt-auto space-y-3">
                <input type="hidden" name="kind" value={kind} />
                <Field label="Fichier Excel rempli" name="file" required>
                  <Input type="file" name="file" required accept=".xlsx" className="h-auto py-1.5" />
                </Field>
                <SubmitButton>Simuler l&apos;import</SubmitButton>
              </ActionForm>
            </CardBody>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader title="Derniers imports" description="Simulations et exécutions, avec leur rapport ligne par ligne" />
        {jobs.length === 0 ? (
          <EmptyState title="Aucun import" />
        ) : (
          <Table>
            <THead>
              <tr>
                <TH>Fichier</TH>
                <TH>Type</TH>
                <TH>Statut</TH>
                <TH className="text-right">Lignes</TH>
                <TH className="text-right">Importées</TH>
                <TH className="text-right">Erreurs</TH>
                <TH>Par</TH>
              </tr>
            </THead>
            <TBody>
              {jobs.map((j) => (
                <TR key={j.id}>
                  <TD>
                    <Link href={`/imports/${j.id}`} className="font-medium text-brand-700 hover:underline">
                      {j.fileName}
                    </Link>
                    <p className="text-xs text-slate-500">{formatDateTime(j.executedAt ?? j.createdAt)}</p>
                  </TD>
                  <TD>{IMPORT_KIND[j.kind] ?? j.kind}</TD>
                  <TD>
                    <Badge tone={IMPORT_STATUS[j.status]?.tone}>{IMPORT_STATUS[j.status]?.label ?? j.status}</Badge>
                    {j.mode ? <p className="mt-0.5 text-xs text-slate-500">{IMPORT_MODE[j.mode]}</p> : null}
                  </TD>
                  <TD className="text-right tabular-nums">{j.totalRows}</TD>
                  <TD className="text-right tabular-nums">{j.status === "DONE" ? j.importedRows : "—"}</TD>
                  <TD className={`text-right tabular-nums ${j.errorRows ? "font-medium text-red-700" : ""}`}>{j.errorRows}</TD>
                  <TD>{j.author}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </Card>
    </>
  );
}
