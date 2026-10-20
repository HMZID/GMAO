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
import { T, Tr } from "@/i18n/client";
import { tpl } from "@/i18n/translate";

export const metadata = { title: "Imports" };

const DESCRIPTIONS: Record<string, string> = {
  EQUIPMENT: "Parc d'engins et de véhicules : société, site, catégorie, compteur principal. Les plans d'entretien de la catégorie s'appliquent.",
  PARTS: "Catalogue des pièces détachées : référence interne, marque et référence fabricant, suivi, criticité.",
  INITIAL_STOCK: "Quantités comptées par magasin et seuils de réapprovisionnement. Importer les articles d'abord.",
  SUPPLIERS: "Fournisseurs et prestataires : raison sociale, identifiant fiscal, contacts ; « Prestataire » pour la sous-traitance.",
  TECHNICIANS: "Ouvriers et techniciens : matricule, site, qualification, heures par jour et taux horaire (planning et coûts).",
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
        description={tpl`Télécharger le modèle, le remplir, puis lancer la simulation : chaque ligne est contrôlée comme une saisie à l'écran avant tout import. ${MAX_IMPORT_ROWS} lignes et 10 Mo au plus par fichier.`}
      />

      <div className="mb-8 grid gap-6 lg:grid-cols-3">
        {kinds.map((kind) => (
          <Card key={kind} className="flex flex-col">
            <CardHeader title={IMPORT_DEFINITIONS[kind].label} description={DESCRIPTIONS[kind]} />
            <CardBody className="flex flex-1 flex-col gap-4">
              <a href={`/api/v1/imports/templates/${kind.toLowerCase()}`} className={buttonClass("secondary", "sm", "self-start")}>
                <Download className="h-4 w-4" aria-hidden />
                <T>Télécharger le modèle</T>
              </a>
              <ActionForm action={simulateImportAction} className="mt-auto space-y-3">
                <input type="hidden" name="kind" value={kind} />
                <Field label="Fichier Excel rempli" name="file" required>
                  <Input type="file" name="file" required accept=".xlsx" className="h-auto py-1.5" />
                </Field>
                <SubmitButton>
                  <T>Simuler l&apos;import</T>
                </SubmitButton>
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
                <TH>
                  <T>Fichier</T>
                </TH>
                <TH>
                  <T>Type</T>
                </TH>
                <TH>
                  <T>Statut</T>
                </TH>
                <TH className="text-end">
                  <T>Lignes</T>
                </TH>
                <TH className="text-end">
                  <T>Importées</T>
                </TH>
                <TH className="text-end">
                  <T>Erreurs</T>
                </TH>
                <TH>
                  <T>Par</T>
                </TH>
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
                  <TD>
                    <Tr>{IMPORT_KIND[j.kind] ?? j.kind}</Tr>
                  </TD>
                  <TD>
                    <Badge tone={IMPORT_STATUS[j.status]?.tone}>
                      <Tr>{IMPORT_STATUS[j.status]?.label ?? j.status}</Tr>
                    </Badge>
                    {j.mode ? (
                      <p className="mt-0.5 text-xs text-slate-500">
                        <Tr>{IMPORT_MODE[j.mode]}</Tr>
                      </p>
                    ) : null}
                  </TD>
                  <TD className="text-end tabular-nums">{j.totalRows}</TD>
                  <TD className="text-end tabular-nums">{j.status === "DONE" ? j.importedRows : "—"}</TD>
                  <TD className={`text-end tabular-nums ${j.errorRows ? "font-medium text-red-700" : ""}`}>{j.errorRows}</TD>
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
