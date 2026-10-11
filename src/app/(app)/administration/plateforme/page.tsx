import { Forbidden } from "@/components/forbidden";
import { ActionForm, Field, SubmitButton } from "@/components/forms/action-form";
import { PageHeader } from "@/components/layout/page-header";
import { Disclosure } from "@/components/ui/disclosure";
import { Input, Select } from "@/components/ui/inputs";
import { Alert, Badge, Card, Table, TBody, TD, TH, THead, TR } from "@/components/ui/primitives";
import { formatDate } from "@/lib/format";
import { getAuthContext } from "@/server/auth/session";
import { DEMO_DURATIONS, TENANT_STATUS_LABEL, type TenantStatus } from "@/server/domain/tenants";
import { isPlatformAdmin, listTenants } from "@/server/services/platform";
import { createDemoTenantAction, updateTenantAccessAction } from "../actions";

export const metadata = { title: "Organisations clientes" };

const DURATION_OPTIONS = DEMO_DURATIONS.map((d) => ({ value: String(d), label: `${d} jours` }));

/** Plateforme : organisations clientes, démonstrations à durée limitée, abonnement, suspension. */
export default async function PlatformPage() {
  const ctx = await getAuthContext();
  if (!isPlatformAdmin(ctx)) return <Forbidden what="l'administration de la plateforme" />;
  const tenants = await listTenants(ctx);

  return (
    <>
      <PageHeader
        back={{ href: "/administration", label: "Administration" }}
        title="Organisations clientes"
        description="Ouvrir une version de démonstration pour un client pendant une période définie, la prolonger, passer en abonnement ou suspendre l'accès."
      />
      <Disclosure summary="Nouvelle démonstration" className="mb-6">
        <ActionForm action={createDemoTenantAction} resetOnSuccess className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Organisation (client)" name="organizationName" required className="sm:col-span-2">
            <Input name="organizationName" required maxLength={120} placeholder="Ex. : Travaux Publics du Rhône" />
          </Field>
          <Field label="Durée" name="durationDays" required>
            <Select name="durationDays" required defaultValue="30" options={DURATION_OPTIONS} />
          </Field>
          <Field
            label="Direction du client (premier compte)"
            name="adminName"
            required
            hint="Tous les droits de son organisation ; il donne les accès à ses équipes"
          >
            <Input name="adminName" required maxLength={120} />
          </Field>
          <Field label="Courriel (identifiant)" name="adminEmail" required>
            <Input name="adminEmail" type="email" required />
          </Field>
          <Field label="Mot de passe initial" name="adminPassword" required hint="10 caractères minimum, à communiquer au client">
            <Input name="adminPassword" type="password" required minLength={10} autoComplete="new-password" />
          </Field>
          <div className="sm:col-span-2 lg:col-span-3">
            <SubmitButton>Ouvrir la démonstration</SubmitButton>
          </div>
        </ActionForm>
      </Disclosure>

      <Card>
        <Table>
          <THead>
            <tr>
              <TH>Organisation</TH>
              <TH>Accès</TH>
              <TH className="text-right">Utilisateurs</TH>
              <TH className="text-right">Équipements</TH>
              <TH>Créée le</TH>
              <TH className="sr-only">Actions</TH>
            </tr>
          </THead>
          <TBody>
            {tenants.map((t) => (
              <TR key={t.id}>
                <TD>
                  <p className="font-medium text-slate-900">
                    {t.displayName || t.name}
                    {t.own ? <Badge className="ml-2">Votre organisation</Badge> : null}
                  </p>
                  {t.contactEmail ? <p className="text-xs text-slate-500">{t.contactEmail}</p> : null}
                </TD>
                <TD>
                  <AccessBadge status={t.status as TenantStatus} access={t.access} demoEndsAt={t.demoEndsAt} />
                </TD>
                <TD className="text-right tabular-nums">{t.users}</TD>
                <TD className="text-right tabular-nums">{t.equipment}</TD>
                <TD className="text-xs">{formatDate(t.createdAt)}</TD>
                <TD>
                  <div className="flex flex-wrap items-end gap-2">
                    {t.status !== "SUSPENDED" ? (
                      <ActionForm action={updateTenantAccessAction.bind(null, t.id)} showMessage={false} className="flex items-end gap-1">
                        <input type="hidden" name="action" value="EXTEND" />
                        <Select name="days" aria-label="Durée de prolongation" defaultValue="14" options={DURATION_OPTIONS} className="h-9 w-28" />
                        <SubmitButton size="sm" variant="secondary">
                          {t.status === "DEMO" ? "Prolonger" : "Repasser en démo"}
                        </SubmitButton>
                      </ActionForm>
                    ) : null}
                    {t.status === "DEMO" ? (
                      <ActionForm action={updateTenantAccessAction.bind(null, t.id)} showMessage={false}>
                        <input type="hidden" name="action" value="ACTIVATE" />
                        <SubmitButton size="sm" variant="secondary">
                          Passer en abonnement
                        </SubmitButton>
                      </ActionForm>
                    ) : null}
                    {t.status === "SUSPENDED" ? (
                      <ActionForm action={updateTenantAccessAction.bind(null, t.id)} showMessage={false}>
                        <input type="hidden" name="action" value="RESUME" />
                        <SubmitButton size="sm" variant="secondary">
                          Rétablir l&apos;accès
                        </SubmitButton>
                      </ActionForm>
                    ) : !t.own ? (
                      <ActionForm action={updateTenantAccessAction.bind(null, t.id)} showMessage={false}>
                        <input type="hidden" name="action" value="SUSPEND" />
                        <SubmitButton size="sm" variant="ghost">
                          Suspendre
                        </SubmitButton>
                      </ActionForm>
                    ) : null}
                  </div>
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </Card>
      <div className="mt-4">
        <Alert tone="blue">
          Une démonstration démarre avec une société, un site, un atelier, un magasin, des catégories d&apos;équipement et son administrateur : le
          client importe ensuite ses engins, fournisseurs, ouvriers et stocks (menu Imports). À la date de fin, ses utilisateurs et ses clés
          d&apos;API n&apos;ont plus accès ; les données sont conservées jusqu&apos;à décision (prolongation ou abonnement).
        </Alert>
      </div>
    </>
  );
}

function AccessBadge({
  status,
  access,
  demoEndsAt,
}: {
  status: TenantStatus;
  access: Awaited<ReturnType<typeof listTenants>>[number]["access"];
  demoEndsAt: Date | null;
}) {
  if (!access.allowed) {
    return (
      <div>
        <Badge tone={access.reason === "SUSPENDED" ? "gray" : "red"}>{access.reason === "SUSPENDED" ? "Suspendue" : "Démonstration échue"}</Badge>
        {demoEndsAt ? <p className="mt-1 text-xs text-slate-500">Fin le {formatDate(demoEndsAt)}</p> : null}
      </div>
    );
  }
  if (access.demo) {
    return (
      <div>
        <Badge tone={access.demo.daysLeft <= 3 ? "amber" : "violet"}>Démonstration</Badge>
        <p className="mt-1 text-xs text-slate-500">
          Jusqu&apos;au {formatDate(access.demo.endsAt)} ({access.demo.daysLeft} j)
        </p>
      </div>
    );
  }
  return <Badge tone="green">{TENANT_STATUS_LABEL[status] ?? status}</Badge>;
}
