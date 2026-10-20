import { Forbidden } from "@/components/forbidden";
import { ActionForm, Field, SubmitButton } from "@/components/forms/action-form";
import { PageHeader } from "@/components/layout/page-header";
import { Disclosure } from "@/components/ui/disclosure";
import { Input, Select } from "@/components/ui/inputs";
import { Badge, Card, Table, TBody, TD, TH, THead, TR } from "@/components/ui/primitives";
import { formatCurrency, formatDate } from "@/lib/format";
import { ABSENCE_TYPE, options } from "@/lib/labels";
import { getAuthContext } from "@/server/auth/session";
import { listSites } from "@/server/services/organization";
import { listTechnicians, listUsers } from "@/server/services/users";
import { addAbsenceAction, createTechnicianAction } from "../actions";
import { T, Tr } from "@/i18n/client";

export const metadata = { title: "Techniciens" };

export default async function TechniciansPage() {
  const ctx = await getAuthContext();
  const canCreate = ctx.can("users.manage");
  const canAbsence = ctx.can("workorder.manage");
  if (!ctx.can("planning.read") || (!canCreate && !canAbsence)) return <Forbidden what="la gestion des techniciens" />;
  const [technicians, sites, users] = await Promise.all([listTechnicians(ctx), listSites(ctx), canCreate ? listUsers(ctx) : Promise.resolve([])]);
  const linked = new Set(technicians.map((t) => t.userId).filter(Boolean));
  const now = new Date();
  const soon = new Date(now.getTime() + 30 * 86_400_000);

  return (
    <>
      <PageHeader
        back={{ href: "/administration", label: "Administration" }}
        title="Techniciens"
        description="Ressources planifiables : site, qualification, horaire journalier, taux horaire (coût de la main-d'œuvre), habilitations et absences."
      />
      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        {canCreate ? (
          <Disclosure summary="Nouveau technicien">
            <ActionForm action={createTechnicianAction} resetOnSuccess className="grid gap-3 sm:grid-cols-2">
              <Field label="Matricule" name="employeeNumber" hint="Unique ; sert à réimporter sans doublon">
                <Input id="t-number" name="employeeNumber" maxLength={40} />
              </Field>
              <Field label="Prénom" name="firstName" required>
                <Input id="t-first" name="firstName" required maxLength={80} />
              </Field>
              <Field label="Nom" name="lastName" required>
                <Input id="t-last" name="lastName" required maxLength={80} />
              </Field>
              <Field label="Site" name="siteId" required>
                <Select id="t-site" name="siteId" required placeholder="Choisir…" options={sites.map((s) => ({ value: s.id, label: s.name }))} />
              </Field>
              <Field label="Qualification" name="qualification">
                <Input id="t-qual" name="qualification" maxLength={120} />
              </Field>
              <Field label="Heures par jour" name="dailyHours">
                <Input id="t-hours" name="dailyHours" type="number" min={1} max={12} defaultValue={7} />
              </Field>
              <Field label="Taux horaire (€)" name="hourlyRate">
                <Input id="t-rate" name="hourlyRate" type="number" min={0} step="0.01" />
              </Field>
              <Field label="Compte utilisateur" name="userId" hint="Pour pointer et réaliser les interventions" className="sm:col-span-2">
                <Select
                  id="t-user"
                  name="userId"
                  placeholder="Aucun (sous-traitant, intérimaire…)"
                  options={users.filter((u) => !linked.has(u.id)).map((u) => ({ value: u.id, label: `${u.name} — ${u.email}` }))}
                />
              </Field>
              <SubmitButton variant="secondary">
                <T>Créer</T>
              </SubmitButton>
            </ActionForm>
          </Disclosure>
        ) : null}
        {canAbsence ? (
          <Disclosure summary="Saisir une absence">
            <ActionForm action={addAbsenceAction} resetOnSuccess className="grid gap-3 sm:grid-cols-2">
              <Field label="Technicien" name="technicianId" required>
                <Select
                  id="a-tech"
                  name="technicianId"
                  required
                  placeholder="Choisir…"
                  options={technicians.map((t) => ({ value: t.id, label: `${t.firstName} ${t.lastName}` }))}
                />
              </Field>
              <Field label="Type" name="type">
                <Select id="a-type" name="type" options={options(ABSENCE_TYPE)} />
              </Field>
              <Field label="Début" name="startAt" required>
                <Input id="a-start" name="startAt" type="datetime-local" required />
              </Field>
              <Field label="Fin" name="endAt" required>
                <Input id="a-end" name="endAt" type="datetime-local" required />
              </Field>
              <Field label="Commentaire" name="comment" className="sm:col-span-2">
                <Input id="a-comment" name="comment" maxLength={300} />
              </Field>
              <SubmitButton variant="secondary">
                <T>Enregistrer</T>
              </SubmitButton>
            </ActionForm>
          </Disclosure>
        ) : null}
      </div>
      <Card>
        <Table>
          <THead>
            <tr>
              <TH>
                <T>Technicien</T>
              </TH>
              <TH>
                <T>Site</T>
              </TH>
              <TH>
                <T>Qualification</T>
              </TH>
              <TH className="text-end">
                <T>Heures / jour</T>
              </TH>
              <TH className="text-end">
                <T>Taux horaire</T>
              </TH>
              <TH>
                <T>Habilitations</T>
              </TH>
              <TH>
                <T>Compte</T>
              </TH>
            </tr>
          </THead>
          <TBody>
            {technicians.map((t) => (
              <TR key={t.id}>
                <TD className="font-medium text-slate-900">
                  <Tr>{t.firstName}</Tr> <Tr>{t.lastName}</Tr>
                  {!t.active ? (
                    <Badge className="ms-2">
                      <T>Inactif</T>
                    </Badge>
                  ) : null}
                  {t.employeeNumber ? (
                    <p className="font-mono text-xs font-normal text-slate-500">
                      <Tr>{t.employeeNumber}</Tr>
                    </p>
                  ) : null}
                </TD>
                <TD>
                  <Tr>{t.site.name}</Tr>
                </TD>
                <TD>{t.qualification ?? "—"}</TD>
                <TD className="text-end tabular-nums">
                  <Tr>{t.dailyHours}</Tr>
                </TD>
                <TD className="text-end tabular-nums">{t.laborRates[0] ? formatCurrency(t.laborRates[0].hourlyRate) : "—"}</TD>
                <TD>
                  <ul className="space-y-1">
                    {t.certifications.map((c) => {
                      const expired = c.validUntil && c.validUntil < now;
                      const expiring = c.validUntil && !expired && c.validUntil < soon;
                      return (
                        <li key={c.id} className="text-xs">
                          <Tr>{c.name}</Tr>{" "}
                          {c.validUntil ? (
                            <Badge tone={expired ? "red" : expiring ? "amber" : "gray"}>
                              <Tr>{expired ? "expirée le" : "jusqu'au"}</Tr> {formatDate(c.validUntil)}
                            </Badge>
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                </TD>
                <TD className="text-xs">{t.user?.email ?? <span className="text-slate-400">—</span>}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </Card>
    </>
  );
}
