import { Download, FileSpreadsheet } from "lucide-react";
import { Forbidden } from "@/components/forbidden";
import { PageHeader } from "@/components/layout/page-header";
import { buttonClass } from "@/components/ui/button";
import { Select } from "@/components/ui/inputs";
import { Alert, Card, CardBody, CardHeader, EmptyState } from "@/components/ui/primitives";
import { formatNumber } from "@/lib/format";
import { getAuthContext } from "@/server/auth/session";
import { exportSummary } from "@/server/services/exports";
import { listCompanies } from "@/server/services/organization";

export const metadata = { title: "Export des données" };

/** Export des données de l'organisation (INT-01) : un classeur complet, ou chaque jeu de données en Excel ou CSV. */
export default async function ExportPage(props: PageProps<"/administration/export">) {
  const ctx = await getAuthContext();
  if (!ctx.can("data.export")) return <Forbidden what="l'export des données" />;
  const companies = await listCompanies(ctx);
  const requested = (await props.searchParams).companyId;
  // Société choisie : seulement l'une de celles du périmètre (sinon, toutes).
  const company = companies.find((c) => c.id === requested) ?? null;
  const datasets = await exportSummary(ctx, company?.id);
  const total = datasets.reduce((sum, d) => sum + d.rows, 0);
  const withCompany = (href: string) => (company ? `${href}${href.includes("?") ? "&" : "?"}companyId=${company.id}` : href);

  return (
    <>
      <PageHeader
        back={{ href: "/administration", label: "Administration" }}
        title="Export des données"
        description={
          company
            ? `Données de la société ${company.name} : un classeur Excel complet, ou chaque jeu de données séparément.`
            : "Toutes les données de votre organisation, dans votre périmètre : un classeur Excel complet, ou chaque jeu de données séparément."
        }
        actions={
          datasets.length > 0 ? (
            <a href={withCompany("/api/v1/exports?format=xlsx")} className={buttonClass("primary")}>
              <FileSpreadsheet className="h-4 w-4" aria-hidden />
              Tout exporter (Excel)
            </a>
          ) : null
        }
      />
      {datasets.length === 0 ? (
        <EmptyState title="Aucune donnée exportable" description="Votre profil ne donne accès à aucun jeu de données." />
      ) : (
        <>
          {companies.length > 1 ? (
            <form method="get" className="mb-4 flex flex-wrap items-end gap-2">
              <label className="text-sm text-slate-700">
                <span className="mb-1 block font-medium">Société</span>
                <Select
                  name="companyId"
                  defaultValue={company?.id ?? ""}
                  placeholder="Toutes les sociétés"
                  options={companies.map((c) => ({ value: c.id, label: c.name }))}
                  className="w-72"
                />
              </label>
              <button type="submit" className={buttonClass("secondary")}>
                Afficher
              </button>
            </form>
          ) : null}
          <p className="mb-4 text-sm text-slate-600">
            {formatNumber(total)} ligne(s) au total dans {datasets.length} jeux de données.
          </p>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {datasets.map((d) => (
              <Card key={d.dataset} className="flex flex-col">
                <CardHeader title={d.label} description={d.description} />
                <CardBody className="mt-auto flex flex-wrap items-center gap-2">
                  <span className="mr-auto text-sm font-medium tabular-nums text-slate-700">{formatNumber(d.rows)} ligne(s)</span>
                  <a
                    href={withCompany(`/api/v1/exports/${d.dataset}?format=xlsx`)}
                    className={buttonClass("secondary", "sm")}
                    aria-label={`${d.label} : télécharger en Excel`}
                  >
                    <Download className="h-4 w-4" aria-hidden />
                    Excel
                  </a>
                  <a
                    href={withCompany(`/api/v1/exports/${d.dataset}?format=csv`)}
                    className={buttonClass("ghost", "sm")}
                    aria-label={`${d.label} : télécharger en CSV`}
                  >
                    CSV
                  </a>
                </CardBody>
              </Card>
            ))}
          </div>
          <div className="mt-6">
            <Alert tone="blue">
              Excel affiche les libellés en français ; CSV garde les codes et les identifiants (dates ISO 8601, séparateur virgule), plus adaptés à un
              traitement automatique. Pour une intégration régulière (ETL), utiliser le connecteur de l&apos;organisation.
            </Alert>
          </div>
        </>
      )}
    </>
  );
}
