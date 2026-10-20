import { Building2, HardHat, MapPin, Warehouse, Wrench } from "lucide-react";
import { Forbidden } from "@/components/forbidden";
import { ActionForm, Field, SubmitButton } from "@/components/forms/action-form";
import { PageHeader } from "@/components/layout/page-header";
import { Disclosure } from "@/components/ui/disclosure";
import { Checkbox, Input } from "@/components/ui/inputs";
import { Badge, Card, CardBody, CardHeader, EmptyState } from "@/components/ui/primitives";
import { formatDate } from "@/lib/format";
import { LOGO_ACCEPT, MAX_DISPLAY_NAME, MAX_LOGO_BYTES } from "@/server/domain/branding";
import { formatSize } from "@/server/domain/documents";
import { getAuthContext } from "@/server/auth/session";
import { getBranding, logoUrl } from "@/server/services/branding";
import { listCompanies, listJobsites, listSites, listWarehouses, listWorkshops } from "@/server/services/organization";
import {
  createCompanyAction,
  createJobsiteAction,
  createSiteAction,
  createWarehouseAction,
  createWorkshopAction,
  removeLogoAction,
  updateBrandingAction,
  uploadLogoAction,
} from "../actions";
import { T, Tr } from "@/i18n/client";
import { tpl } from "@/i18n/translate";

export const metadata = { title: "Organisation" };

export default async function OrganisationPage() {
  const ctx = await getAuthContext();
  if (!ctx.can("settings.manage")) return <Forbidden what="le paramétrage de l'organisation" />;
  const [branding, companies, sites, workshops, warehouses, jobsites] = await Promise.all([
    getBranding(ctx),
    listCompanies(ctx),
    listSites(ctx),
    listWorkshops(ctx),
    listWarehouses(ctx),
    listJobsites(ctx),
  ]);

  return (
    <>
      <PageHeader
        back={{ href: "/administration", label: "Administration" }}
        title="Organisation"
        description="Chaque société a ses sites ; chaque site a ses ateliers et ses magasins ; les chantiers appartiennent à une société. Les codes sont uniques dans l'organisation."
      />
      <IdentityCard branding={branding} />

      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <h2 className="text-lg font-semibold text-slate-900">
          <T>Sociétés</T> <span className="text-sm font-normal text-slate-500">({companies.length})</span>
        </h2>
        <Disclosure summary="Nouvelle société">
          <ActionForm action={createCompanyAction} resetOnSuccess className="grid gap-3 sm:grid-cols-2">
            <Field label="Code" name="code" required>
              <Input name="code" required maxLength={30} />
            </Field>
            <Field label="Raison sociale" name="name" required>
              <Input name="name" required maxLength={120} />
            </Field>
            <Field label="Pays (ISO)" name="country">
              <Input name="country" defaultValue="FR" maxLength={2} />
            </Field>
            <Field label="Devise" name="currency">
              <Input name="currency" defaultValue="EUR" maxLength={3} />
            </Field>
            <SubmitButton variant="secondary">
              <T>Créer la société</T>
            </SubmitButton>
          </ActionForm>
        </Disclosure>
      </div>

      {companies.length === 0 ? (
        <Card>
          <EmptyState title="Aucune société" description="Créer la première société, puis ses sites, ateliers et magasins." />
        </Card>
      ) : (
        <div className="space-y-6">
          {companies.map((company) => {
            const companySites = sites.filter((s) => s.companyId === company.id);
            const companyJobsites = jobsites.filter((j) => j.companyId === company.id);
            return (
              <Card key={company.id} aria-label={tpl`Société ${company.name}`}>
                <CardHeader
                  title={
                    <span className="flex flex-wrap items-center gap-2">
                      <Building2 className="h-5 w-5 text-brand-700" aria-hidden />
                      {company.name}
                      <span className="font-mono text-xs font-normal text-slate-500">{company.code}</span>
                    </span>
                  }
                  description={tpl`${companySites.length} site(s) · ${companyJobsites.length} chantier(s) · ${company.country} · ${company.currency}`}
                />
                <CardBody className="space-y-4">
                  {companySites.length === 0 ? (
                    <p className="text-sm text-slate-500">
                      <T>Aucun site pour cette société.</T>
                    </p>
                  ) : null}
                  <div className="grid gap-4 lg:grid-cols-2">
                    {companySites.map((site) => {
                      const siteWorkshops = workshops.filter((w) => w.siteId === site.id);
                      const siteWarehouses = warehouses.filter((w) => w.siteId === site.id);
                      return (
                        <section key={site.id} aria-label={tpl`Site ${site.name}`} className="rounded-lg border border-slate-200 p-4">
                          <h3 className="flex flex-wrap items-center gap-2 font-semibold text-slate-900">
                            <MapPin className="h-4 w-4 text-slate-500" aria-hidden />
                            {site.name}
                            <span className="font-mono text-xs font-normal text-slate-500">{site.code}</span>
                            {!site.active ? (
                              <Badge>
                                <T>Inactif</T>
                              </Badge>
                            ) : null}
                          </h3>
                          <div className="mt-3 grid gap-3 sm:grid-cols-2">
                            <div>
                              <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">
                                <T>Ateliers</T>
                              </p>
                              {siteWorkshops.length === 0 ? (
                                <p className="text-sm text-slate-400">
                                  <T>Aucun</T>
                                </p>
                              ) : (
                                <ul className="space-y-1 text-sm">
                                  {siteWorkshops.map((w) => (
                                    <li key={w.id} className="flex flex-wrap items-center gap-2">
                                      <Wrench className="h-3.5 w-3.5 text-slate-400" aria-hidden />
                                      {w.name}
                                      <span className="text-xs text-slate-500">
                                        <T params={{ code: w.code, bays: w.bays }}>{"{code} · {bays} poste(s)"}</T>
                                      </span>
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </div>
                            <div>
                              <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">
                                <T>Magasins</T>
                              </p>
                              {siteWarehouses.length === 0 ? (
                                <p className="text-sm text-slate-400">
                                  <T>Aucun</T>
                                </p>
                              ) : (
                                <ul className="space-y-1 text-sm">
                                  {siteWarehouses.map((w) => (
                                    <li key={w.id} className="flex flex-wrap items-center gap-2">
                                      <Warehouse className="h-3.5 w-3.5 text-slate-400" aria-hidden />
                                      {w.name}
                                      <span className="text-xs text-slate-500">{w.code}</span>
                                      {w.isMobile ? (
                                        <Badge tone="violet">
                                          <T>Mobile</T>
                                        </Badge>
                                      ) : null}
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </div>
                          </div>
                          <div className="mt-3 grid gap-2 sm:grid-cols-2">
                            <Disclosure summary="Ajouter un atelier">
                              <ActionForm action={createWorkshopAction} resetOnSuccess className="space-y-2">
                                <input type="hidden" name="siteId" value={site.id} />
                                <Field label="Code" name="code" required>
                                  <Input name="code" required maxLength={30} />
                                </Field>
                                <Field label="Nom" name="name" required>
                                  <Input name="name" required maxLength={120} />
                                </Field>
                                <Field label="Postes de travail" name="bays">
                                  <Input name="bays" type="number" min={1} defaultValue={1} />
                                </Field>
                                <SubmitButton size="sm" variant="secondary">
                                  <T>Créer l&apos;atelier</T>
                                </SubmitButton>
                              </ActionForm>
                            </Disclosure>
                            <Disclosure summary="Ajouter un magasin">
                              <ActionForm action={createWarehouseAction} resetOnSuccess className="space-y-2">
                                <input type="hidden" name="siteId" value={site.id} />
                                <Field label="Code" name="code" required>
                                  <Input name="code" required maxLength={30} />
                                </Field>
                                <Field label="Nom" name="name" required>
                                  <Input name="name" required maxLength={120} />
                                </Field>
                                <Checkbox name="isMobile" label="Magasin mobile (camion atelier)" />
                                <SubmitButton size="sm" variant="secondary">
                                  <T>Créer le magasin</T>
                                </SubmitButton>
                              </ActionForm>
                            </Disclosure>
                          </div>
                        </section>
                      );
                    })}
                  </div>

                  {companyJobsites.length > 0 ? (
                    <div>
                      <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">
                        <T>Chantiers</T>
                      </p>
                      <ul className="grid gap-1 text-sm sm:grid-cols-2">
                        {companyJobsites.map((j) => (
                          <li key={j.id} className="flex flex-wrap items-center gap-2">
                            <HardHat className="h-3.5 w-3.5 text-slate-400" aria-hidden />
                            {j.name}
                            <span className="text-xs text-slate-500">
                              {j.code} · {formatDate(j.startDate)} → {j.endDate ? formatDate(j.endDate) : "en cours"}
                            </span>
                            {!j.active ? (
                              <Badge>
                                <T>Clos</T>
                              </Badge>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  <div className="grid gap-2 border-t border-slate-100 pt-3 sm:grid-cols-2">
                    <Disclosure summary="Ajouter un site">
                      <ActionForm action={createSiteAction} resetOnSuccess className="space-y-2">
                        <input type="hidden" name="companyId" value={company.id} />
                        <Field label="Code" name="code" required>
                          <Input name="code" required maxLength={30} />
                        </Field>
                        <Field label="Nom" name="name" required>
                          <Input name="name" required maxLength={120} />
                        </Field>
                        <Field label="Adresse" name="address">
                          <Input name="address" maxLength={250} />
                        </Field>
                        <SubmitButton size="sm" variant="secondary">
                          <T>Créer le site</T>
                        </SubmitButton>
                      </ActionForm>
                    </Disclosure>
                    <Disclosure summary="Ajouter un chantier">
                      <ActionForm action={createJobsiteAction} resetOnSuccess className="space-y-2">
                        <input type="hidden" name="companyId" value={company.id} />
                        <Field label="Code" name="code" required>
                          <Input name="code" required maxLength={30} />
                        </Field>
                        <Field label="Nom" name="name" required>
                          <Input name="name" required maxLength={120} />
                        </Field>
                        <Field label="Adresse" name="address">
                          <Input name="address" maxLength={250} />
                        </Field>
                        <div className="grid grid-cols-2 gap-2">
                          <Field label="Début" name="startDate">
                            <Input name="startDate" type="date" />
                          </Field>
                          <Field label="Fin prévue" name="endDate">
                            <Input name="endDate" type="date" />
                          </Field>
                        </div>
                        <SubmitButton size="sm" variant="secondary">
                          <T>Créer le chantier</T>
                        </SubmitButton>
                      </ActionForm>
                    </Disclosure>
                  </div>
                </CardBody>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}

/** Identité : nom affiché sous « GMAO » et logo (en-tête de l'application, états imprimés). */
function IdentityCard({ branding }: { branding: Awaited<ReturnType<typeof getBranding>> }) {
  const logo = logoUrl(branding);
  return (
    <Card className="mb-6">
      <CardHeader title="Identité de l'organisation" description="Nom et logo affichés sous « GMAO » dans l'application et sur les états imprimés." />
      <CardBody className="grid gap-6 md:grid-cols-2">
        <ActionForm action={updateBrandingAction} className="space-y-3">
          <Field label="Nom affiché" name="displayName" hint={tpl`Par défaut : ${branding.name}`}>
            <Input name="displayName" defaultValue={branding.displayName ?? ""} maxLength={MAX_DISPLAY_NAME} placeholder={branding.name} />
          </Field>
          <SubmitButton variant="secondary">
            <T>Enregistrer le nom</T>
          </SubmitButton>
        </ActionForm>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
          <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
            {logo ? (
              // eslint-disable-next-line @next/next/no-img-element -- image servie par l'API, après contrôle de session
              <img src={logo} alt="Logo actuel" className="max-h-full max-w-full object-contain" />
            ) : (
              <span className="px-2 text-center text-xs text-slate-500">
                <T>Aucun logo</T>
              </span>
            )}
          </div>
          <div className="min-w-0 flex-1 space-y-3">
            <ActionForm action={uploadLogoAction} resetOnSuccess className="space-y-3">
              <Field label="Logo" name="logo" required hint={tpl`PNG, JPEG ou WebP ; ${formatSize(MAX_LOGO_BYTES)} au plus ; de préférence carré`}>
                <Input type="file" name="logo" required accept={LOGO_ACCEPT} className="h-auto py-1.5" />
              </Field>
              <SubmitButton variant="secondary">
                <Tr>{logo ? "Remplacer le logo" : "Ajouter le logo"}</Tr>
              </SubmitButton>
            </ActionForm>
            {logo ? (
              <ActionForm action={removeLogoAction}>
                <SubmitButton variant="ghost" size="sm">
                  <T>Retirer le logo</T>
                </SubmitButton>
              </ActionForm>
            ) : null}
          </div>
        </div>
      </CardBody>
    </Card>
  );
}
