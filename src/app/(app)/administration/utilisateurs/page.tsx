import { Forbidden } from "@/components/forbidden";
import { ActionForm, Field, SubmitButton } from "@/components/forms/action-form";
import { PageHeader } from "@/components/layout/page-header";
import { Disclosure } from "@/components/ui/disclosure";
import { Input, Select } from "@/components/ui/inputs";
import { Alert, Badge, Card, Table, TBody, TD, TH, THead, TR } from "@/components/ui/primitives";
import { formatDate, formatDateTime } from "@/lib/format";
import { ROLE, options } from "@/lib/labels";
import { getAuthContext } from "@/server/auth/session";
import { listCompanies, listSites } from "@/server/services/organization";
import { listUsers } from "@/server/services/users";
import { addRoleAction, createUserAction, removeRoleAction, setUserActiveAction, setUserPasswordAction, updateUserAction } from "../actions";
import { T, Tr } from "@/i18n/client";
import { tpl } from "@/i18n/translate";

export const metadata = { title: "Utilisateurs et habilitations" };

export default async function UsersPage() {
  const ctx = await getAuthContext();
  if (!ctx.can("users.manage")) return <Forbidden what="la gestion des utilisateurs" />;
  const [users, companies, sites] = await Promise.all([listUsers(ctx), listCompanies(ctx), listSites(ctx)]);
  const scopeOptions = [
    { value: "TENANT", label: "Tout le groupe" },
    ...companies.map((c) => ({ value: `COMPANY:${c.id}`, label: tpl`Société — ${c.name}` })),
    ...sites.map((s) => ({ value: `SITE:${s.id}`, label: tpl`Site — ${s.name}` })),
  ];
  const now = new Date();
  // Rôles d'une organisation : celui d'administrateur de la plateforme ne se donne pas ici.
  const roleOptions = options(ROLE).filter((o) => o.value !== "ADMIN");
  const active = users.filter((u) => u.isActive).length;

  return (
    <>
      <PageHeader
        back={{ href: "/administration", label: "Administration" }}
        title="Utilisateurs et habilitations"
        description={tpl`${active} compte(s) actif(s), ${users.length - active} désactivé(s). Un utilisateur cumule des couples rôle × périmètre ; une délégation temporaire est un rôle borné dans le temps.`}
      />
      <Disclosure summary="Nouveau compte" className="mb-6">
        <ActionForm action={createUserAction} resetOnSuccess className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Nom et prénom" name="name" required>
            <Input id="u-name" name="name" required maxLength={120} />
          </Field>
          <Field label="Courriel (identifiant)" name="email" required>
            <Input id="u-email" name="email" type="email" required />
          </Field>
          <Field
            label="Mot de passe initial"
            name="password"
            required
            hint="10 caractères minimum ; l'authentification Entra ID s'active par configuration"
          >
            <Input id="u-password" name="password" type="password" required minLength={10} autoComplete="new-password" />
          </Field>
          <Field label="Rôle" name="role" required>
            <Select id="u-role" name="role" required options={roleOptions} defaultValue="TECHNICIAN" />
          </Field>
          <Field label="Périmètre" name="scopeId" required>
            <Select id="u-scope" name="scope" required options={scopeOptions} />
          </Field>
          <div className="flex items-end">
            <SubmitButton>
              <T>Créer le compte</T>
            </SubmitButton>
          </div>
        </ActionForm>
      </Disclosure>
      <Card>
        <Table>
          <THead>
            <tr>
              <TH>
                <T>Utilisateur</T>
              </TH>
              <TH>
                <T>Rôles × périmètres</T>
              </TH>
              <TH>
                <T>Dernière connexion</T>
              </TH>
              <TH>
                <T>Compte</T>
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
                <TD className="min-w-96">
                  <ul className="space-y-1.5">
                    {u.assignments.map((a) => {
                      const expired = a.validTo && a.validTo < now;
                      const future = a.validFrom && a.validFrom > now;
                      return (
                        <li key={a.id} className="flex flex-wrap items-center gap-2">
                          <Badge tone={a.role === "ADMIN" ? "red" : "blue"}>{ROLE[a.role] ?? a.role}</Badge>
                          <span className="text-sm text-slate-700">{a.scopeLabel}</span>
                          {a.validFrom || a.validTo ? (
                            <Badge tone={expired ? "gray" : future ? "amber" : "violet"}>
                              <T params={{ from: a.validFrom ? formatDate(a.validFrom) : "", to: a.validTo ? formatDate(a.validTo) : "" }}>
                                {a.validFrom && a.validTo
                                  ? "Délégation du {from} au {to}"
                                  : a.validFrom
                                    ? "Délégation du {from}"
                                    : "Délégation au {to}"}
                              </T>
                            </Badge>
                          ) : null}
                          <ActionForm action={removeRoleAction.bind(null, a.id)} showMessage={false} className="inline">
                            <SubmitButton size="sm" variant="ghost">
                              <T>Retirer</T>
                            </SubmitButton>
                          </ActionForm>
                        </li>
                      );
                    })}
                  </ul>
                  <Disclosure summary="Ajouter un rôle ou une délégation" className="mt-2">
                    <ActionForm action={addRoleAction.bind(null, u.id)} className="grid gap-2 sm:grid-cols-2">
                      <Field label="Rôle" name="role" required>
                        <Select id={`r-${u.id}`} name="role" required options={roleOptions} />
                      </Field>
                      <Field label="Périmètre" name="scopeId" required>
                        <Select id={`s-${u.id}`} name="scope" required options={scopeOptions} />
                      </Field>
                      <Field label="Du (délégation)" name="validFrom">
                        <Input id={`f-${u.id}`} name="validFrom" type="date" />
                      </Field>
                      <Field label="Au" name="validTo">
                        <Input id={`t-${u.id}`} name="validTo" type="date" />
                      </Field>
                      <SubmitButton size="sm" variant="secondary">
                        <T>Ajouter</T>
                      </SubmitButton>
                    </ActionForm>
                  </Disclosure>
                </TD>
                <TD className="whitespace-nowrap text-xs">
                  <Tr>{u.lastLoginAt ? formatDateTime(u.lastLoginAt) : "Jamais"}</Tr>
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
                  {u.id !== ctx.userId ? (
                    <ActionForm action={setUserActiveAction.bind(null, u.id, !u.isActive)} className="mt-2">
                      <SubmitButton size="sm" variant={u.isActive ? "ghost" : "secondary"}>
                        <Tr>{u.isActive ? "Désactiver" : "Réactiver"}</Tr>
                      </SubmitButton>
                    </ActionForm>
                  ) : null}
                  <Disclosure summary="Modifier le compte" className="mt-2 min-w-64">
                    <div className="space-y-4">
                      <ActionForm action={updateUserAction.bind(null, u.id)} className="space-y-2">
                        <Field label="Nom et prénom" name="name" required>
                          <Input name="name" required maxLength={120} defaultValue={u.name} />
                        </Field>
                        <Field label="Courriel (identifiant)" name="email" required>
                          <Input name="email" type="email" required defaultValue={u.email} />
                        </Field>
                        <SubmitButton size="sm" variant="secondary">
                          <T>Enregistrer</T>
                        </SubmitButton>
                      </ActionForm>
                      <ActionForm action={setUserPasswordAction.bind(null, u.id)} resetOnSuccess className="space-y-2 border-t border-slate-100 pt-3">
                        <Field label="Nouveau mot de passe" name="password" required hint="10 caractères minimum">
                          <Input name="password" type="password" required minLength={10} autoComplete="new-password" />
                        </Field>
                        <SubmitButton size="sm" variant="secondary">
                          <T>Remplacer le mot de passe</T>
                        </SubmitButton>
                      </ActionForm>
                    </div>
                  </Disclosure>
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </Card>
      <div className="mt-4">
        <Alert tone="blue">
          <T>Un compte désactivé conserve tout son historique ; ses sessions ouvertes sont fermées immédiatement.</T>
        </Alert>
      </div>
    </>
  );
}
