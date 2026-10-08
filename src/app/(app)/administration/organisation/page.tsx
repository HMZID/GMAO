import { Forbidden } from "@/components/forbidden";
import { ActionForm, Field, SubmitButton } from "@/components/forms/action-form";
import { PageHeader } from "@/components/layout/page-header";
import { Disclosure } from "@/components/ui/disclosure";
import { Checkbox, Input, Select } from "@/components/ui/inputs";
import { Badge, Card, CardBody, CardHeader, EmptyState, Table, TBody, TD, TH, THead, TR } from "@/components/ui/primitives";
import { formatDate } from "@/lib/format";
import { getAuthContext } from "@/server/auth/session";
import { listCompanies, listJobsites, listSites, listWarehouses, listWorkshops } from "@/server/services/organization";
import { createCompanyAction, createJobsiteAction, createSiteAction, createWarehouseAction, createWorkshopAction } from "../actions";

export const metadata = { title: "Organisation" };

export default async function OrganisationPage() {
  const ctx = await getAuthContext();
  if (!ctx.can("settings.manage")) return <Forbidden what="le paramétrage de l'organisation" />;
  const [companies, sites, workshops, warehouses, jobsites] = await Promise.all([
    listCompanies(ctx),
    listSites(ctx),
    listWorkshops(ctx),
    listWarehouses(ctx),
    listJobsites(ctx),
  ]);
  const companyOptions = companies.map((c) => ({ value: c.id, label: c.name }));
  const siteOptions = sites.map((s) => ({ value: s.id, label: `${s.name} (${s.companyName})` }));

  return (
    <>
      <PageHeader
        back={{ href: "/administration", label: "Administration" }}
        title="Organisation"
        description="Groupe → sociétés → sites → ateliers et magasins ; les chantiers appartiennent à une société (CDC §1.3). Les codes sont uniques."
      />
      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader title="Sociétés" />
          <Table>
            <THead>
              <tr>
                <TH>Code</TH>
                <TH>Raison sociale</TH>
                <TH>Pays · devise</TH>
              </tr>
            </THead>
            <TBody>
              {companies.map((c) => (
                <TR key={c.id}>
                  <TD className="font-mono text-xs">{c.code}</TD>
                  <TD>{c.name}</TD>
                  <TD>
                    {c.country} · {c.currency}
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
          <CardBody className="border-t border-slate-100">
            <Disclosure summary="Nouvelle société">
              <ActionForm action={createCompanyAction} resetOnSuccess className="grid gap-3 sm:grid-cols-2">
                <Field label="Code" name="code" required>
                  <Input id="co-code" name="code" required maxLength={30} />
                </Field>
                <Field label="Raison sociale" name="name" required>
                  <Input id="co-name" name="name" required maxLength={120} />
                </Field>
                <Field label="Pays (ISO)" name="country">
                  <Input id="co-country" name="country" defaultValue="FR" maxLength={2} />
                </Field>
                <Field label="Devise" name="currency">
                  <Input id="co-currency" name="currency" defaultValue="EUR" maxLength={3} />
                </Field>
                <SubmitButton variant="secondary">Créer</SubmitButton>
              </ActionForm>
            </Disclosure>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Sites" />
          <Table>
            <THead>
              <tr>
                <TH>Code</TH>
                <TH>Site</TH>
                <TH>Société</TH>
                <TH>Fuseau</TH>
              </tr>
            </THead>
            <TBody>
              {sites.map((s) => (
                <TR key={s.id}>
                  <TD className="font-mono text-xs">{s.code}</TD>
                  <TD>
                    {s.name} {!s.active ? <Badge>Inactif</Badge> : null}
                  </TD>
                  <TD>{s.companyName}</TD>
                  <TD className="text-xs">{s.timezone}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
          <CardBody className="border-t border-slate-100">
            <Disclosure summary="Nouveau site">
              <ActionForm action={createSiteAction} resetOnSuccess className="grid gap-3 sm:grid-cols-2">
                <Field label="Société" name="companyId" required className="sm:col-span-2">
                  <Select id="si-company" name="companyId" required placeholder="Choisir…" options={companyOptions} />
                </Field>
                <Field label="Code" name="code" required>
                  <Input id="si-code" name="code" required maxLength={30} />
                </Field>
                <Field label="Nom" name="name" required>
                  <Input id="si-name" name="name" required maxLength={120} />
                </Field>
                <Field label="Adresse" name="address" className="sm:col-span-2">
                  <Input id="si-address" name="address" maxLength={250} />
                </Field>
                <SubmitButton variant="secondary">Créer</SubmitButton>
              </ActionForm>
            </Disclosure>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Ateliers" description="Le nombre de postes (baies) sert à la capacité" />
          {workshops.length === 0 ? (
            <EmptyState title="Aucun atelier" />
          ) : (
            <Table>
              <THead>
                <tr>
                  <TH>Code</TH>
                  <TH>Atelier</TH>
                  <TH>Site</TH>
                  <TH className="text-right">Postes</TH>
                </tr>
              </THead>
              <TBody>
                {workshops.map((w) => (
                  <TR key={w.id}>
                    <TD className="font-mono text-xs">{w.code}</TD>
                    <TD>{w.name}</TD>
                    <TD>{w.siteName}</TD>
                    <TD className="text-right tabular-nums">{w.bays}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
          <CardBody className="border-t border-slate-100">
            <Disclosure summary="Nouvel atelier">
              <ActionForm action={createWorkshopAction} resetOnSuccess className="grid gap-3 sm:grid-cols-2">
                <Field label="Site" name="siteId" required className="sm:col-span-2">
                  <Select id="ws-site" name="siteId" required placeholder="Choisir…" options={siteOptions} />
                </Field>
                <Field label="Code" name="code" required>
                  <Input id="ws-code" name="code" required maxLength={30} />
                </Field>
                <Field label="Nom" name="name" required>
                  <Input id="ws-name" name="name" required maxLength={120} />
                </Field>
                <Field label="Postes de travail" name="bays">
                  <Input id="ws-bays" name="bays" type="number" min={1} defaultValue={1} />
                </Field>
                <div className="flex items-end">
                  <SubmitButton variant="secondary">Créer</SubmitButton>
                </div>
              </ActionForm>
            </Disclosure>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Magasins" description="Un magasin peut être mobile (camion atelier)" />
          <Table>
            <THead>
              <tr>
                <TH>Code</TH>
                <TH>Magasin</TH>
                <TH>Site</TH>
              </tr>
            </THead>
            <TBody>
              {warehouses.map((w) => (
                <TR key={w.id}>
                  <TD className="font-mono text-xs">{w.code}</TD>
                  <TD>
                    {w.name} {w.isMobile ? <Badge tone="violet">Mobile</Badge> : null}
                  </TD>
                  <TD>{w.siteName}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
          <CardBody className="border-t border-slate-100">
            <Disclosure summary="Nouveau magasin">
              <ActionForm action={createWarehouseAction} resetOnSuccess className="grid gap-3 sm:grid-cols-2">
                <Field label="Site" name="siteId" required className="sm:col-span-2">
                  <Select id="wh-site" name="siteId" required placeholder="Choisir…" options={siteOptions} />
                </Field>
                <Field label="Code" name="code" required>
                  <Input id="wh-code" name="code" required maxLength={30} />
                </Field>
                <Field label="Nom" name="name" required>
                  <Input id="wh-name" name="name" required maxLength={120} />
                </Field>
                <Checkbox name="isMobile" label="Magasin mobile (camion atelier)" />
                <SubmitButton variant="secondary">Créer</SubmitButton>
              </ActionForm>
            </Disclosure>
          </CardBody>
        </Card>

        <Card className="xl:col-span-2">
          <CardHeader title="Chantiers" />
          <Table>
            <THead>
              <tr>
                <TH>Code</TH>
                <TH>Chantier</TH>
                <TH>Société</TH>
                <TH>Adresse</TH>
                <TH>Période</TH>
              </tr>
            </THead>
            <TBody>
              {jobsites.map((j) => (
                <TR key={j.id}>
                  <TD className="font-mono text-xs">{j.code}</TD>
                  <TD>
                    {j.name} {!j.active ? <Badge>Clos</Badge> : null}
                  </TD>
                  <TD>{j.companyName}</TD>
                  <TD className="text-xs">{j.address ?? "—"}</TD>
                  <TD className="whitespace-nowrap text-xs">
                    {formatDate(j.startDate)} → {j.endDate ? formatDate(j.endDate) : "en cours"}
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
          <CardBody className="border-t border-slate-100">
            <Disclosure summary="Nouveau chantier">
              <ActionForm action={createJobsiteAction} resetOnSuccess className="grid gap-3 sm:grid-cols-3">
                <Field label="Société" name="companyId" required>
                  <Select id="js-company" name="companyId" required placeholder="Choisir…" options={companyOptions} />
                </Field>
                <Field label="Code" name="code" required>
                  <Input id="js-code" name="code" required maxLength={30} />
                </Field>
                <Field label="Nom" name="name" required>
                  <Input id="js-name" name="name" required maxLength={120} />
                </Field>
                <Field label="Adresse" name="address">
                  <Input id="js-address" name="address" maxLength={250} />
                </Field>
                <Field label="Début" name="startDate">
                  <Input id="js-start" name="startDate" type="date" />
                </Field>
                <Field label="Fin prévue" name="endDate">
                  <Input id="js-end" name="endDate" type="date" />
                </Field>
                <SubmitButton variant="secondary">Créer</SubmitButton>
              </ActionForm>
            </Disclosure>
          </CardBody>
        </Card>
      </div>
    </>
  );
}
