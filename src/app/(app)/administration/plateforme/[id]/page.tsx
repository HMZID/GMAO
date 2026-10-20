import { Forbidden } from "@/components/forbidden";
import { ActionForm, Field, SubmitButton } from "@/components/forms/action-form";
import { PageHeader } from "@/components/layout/page-header";
import { Disclosure } from "@/components/ui/disclosure";
import { Input, Select } from "@/components/ui/inputs";
import { Alert, Badge, Card, CardBody, CardHeader, EmptyState, Table, TBody, TD, TH, THead, TR } from "@/components/ui/primitives";
import { formatDate } from "@/lib/format";
import { ROLE, options } from "@/lib/labels";
import { getAuthContext } from "@/server/auth/session";
import { loadOr404 } from "@/server/pages";
import { getTenantDetail, isPlatformAdmin } from "@/server/services/platform";
import { createTenantUserAction, startImpersonationAction } from "../../actions";
import { T, Tr } from "@/i18n/client";
import { tpl } from "@/i18n/translate";

export const metadata = { title: "Organisation cliente" };

/** Une organisation vue par la plateforme : sociétés et sites, comptes, création de compte, connexion « en tant que ». */
export default async function TenantPage(props: PageProps<"/administration/plateforme/[id]">) {
  const { id } = await props.params;
  const ctx = await getAuthContext();
  if (!isPlatformAdmin(ctx)) return <Forbidden what="l'administration de la plateforme" />;
  const detail = await loadOr404(id, (x) => getTenantDetail(ctx, x));
  const { tenant, companies, users } = detail;
  const access = tenant.access;
  const scopeOptions = [
    { value: "TENANT", label: "Tout le groupe" },
    ...companies.map((c) => ({ value: `COMPANY:${c.id}`, label: tpl`Société — ${c.name}` })),
    ...companies.flatMap((c) => c.sites.map((s) => ({ value: `SITE:${s.id}`, label: tpl`Site — ${s.name} (${c.name})` }))),
  ];
  const roleOptions = options(ROLE).filter((o) => o.value !== "ADMIN");

  return (
    <>
      <PageHeader
        back={{ href: "/administration/plateforme", label: "Organisations clientes" }}
        title={tenant.displayName || tenant.name}
        description={
          access.allowed
            ? access.demo
              ? tpl`Démonstration jusqu'au ${formatDate(access.demo.endsAt)} (${access.demo.daysLeft} jour(s)).`
              : "Abonnement actif."
            : access.reason === "SUSPENDED"
              ? "Organisation suspendue : ses utilisateurs n'ont plus accès."
              : "Démonstration échue : ses utilisateurs n'ont plus accès."
        }
      />

      <Card className="mb-6">
        <CardHeader title="Sociétés et sites" description={tpl`${companies.length} société(s)`} />
        <CardBody>
          {companies.length === 0 ? (
            <p className="text-sm text-slate-500">
              <T>Aucune société.</T>
            </p>
          ) : (
            <ul className="grid gap-3 md:grid-cols-2">
              {companies.map((c) => (
                <li key={c.id} className="rounded-md border border-slate-200 p-3">
                  <p className="font-medium text-slate-900">
                    {c.name} <span className="font-mono text-xs text-slate-500">{c.code}</span>
                  </p>
                  <p className="mt-1 text-sm text-slate-600">
                    <Tr>{c.sites.length > 0 ? c.sites.map((s) => s.name).join(" · ") : "Aucun site"}</Tr>
                  </p>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <h2 className="text-lg font-semibold text-slate-900">
          <T>Comptes</T> <span className="text-sm font-normal text-slate-500">({users.length})</span>
        </h2>
        <Disclosure summary="Nouveau compte">
          <ActionForm action={createTenantUserAction.bind(null, tenant.id)} resetOnSuccess className="grid gap-3 sm:grid-cols-2">
            <Field label="Nom et prénom" name="name" required>
              <Input name="name" required maxLength={120} />
            </Field>
            <Field label="Courriel (identifiant)" name="email" required>
              <Input name="email" type="email" required />
            </Field>
            <Field label="Mot de passe initial" name="password" required hint="10 caractères minimum">
              <Input name="password" type="password" required minLength={10} autoComplete="new-password" />
            </Field>
            <Field label="Rôle" name="role" required>
              <Select name="role" required options={roleOptions} defaultValue="EXECUTIVE" />
            </Field>
            <Field label="Périmètre" name="scope" required className="sm:col-span-2">
              <Select name="scope" required options={scopeOptions} defaultValue="TENANT" />
            </Field>
            <SubmitButton>
              <T>Créer le compte</T>
            </SubmitButton>
          </ActionForm>
        </Disclosure>
      </div>
      <Card>
        {users.length === 0 ? (
          <EmptyState title="Aucun compte" />
        ) : (
          <Table>
            <THead>
              <tr>
                <TH>
                  <T>Utilisateur</T>
                </TH>
                <TH>
                  <T>Rôles</T>
                </TH>
                <TH>
                  <T>Compte</T>
                </TH>
                <TH className="sr-only">
                  <T>Actions</T>
                </TH>
              </tr>
            </THead>
            <TBody>
              {users.map((u) => (
                <TR key={u.id}>
                  <TD>
                    <p className="font-medium text-slate-900">{u.name}</p>
                    <p className="text-xs text-slate-500">{u.email}</p>
                  </TD>
                  <TD>
                    <ul className="space-y-1">
                      {u.roles.map((r, i) => (
                        <li key={i} className="flex flex-wrap items-center gap-2 text-sm">
                          <Badge tone={r.role === "ADMIN" ? "red" : "blue"}>
                            <Tr>{ROLE[r.role] ?? r.role}</Tr>
                          </Badge>
                          {r.scope}
                        </li>
                      ))}
                    </ul>
                  </TD>
                  <TD>
                    {u.isActive ? (
                      <Badge tone="green">
                        <T>Actif</T>
                      </Badge>
                    ) : (
                      <Badge>
                        <T>Désactivé</T>
                      </Badge>
                    )}
                  </TD>
                  <TD>
                    {u.isActive && !u.platformAdmin && u.id !== ctx.userId ? (
                      <ActionForm action={startImpersonationAction.bind(null, u.id)}>
                        <SubmitButton size="sm" variant="secondary">
                          <T>Se connecter en tant que</T>
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
      <div className="mt-4">
        <Alert tone="blue">
          <T>
            « Se connecter en tant que » ouvre l&apos;application exactement comme l&apos;utilisateur la voit (menus, données, droits), pendant 4
            heures au plus. Un bandeau le rappelle sur chaque page ; chaque action est tracée au journal d&apos;audit au nom de l&apos;utilisateur et
            de l&apos;administrateur de la plateforme.
          </T>
        </Alert>
      </div>
    </>
  );
}
