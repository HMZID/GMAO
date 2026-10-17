import Link from "next/link";
import { Forbidden } from "@/components/forbidden";
import { ActionForm, ActionPanel, Field, PanelForm, SubmitButton } from "@/components/forms/action-form";
import { PageHeader } from "@/components/layout/page-header";
import { Checkbox, Input, Select, Textarea } from "@/components/ui/inputs";
import { Alert, Badge, Card, CardBody, CardHeader, DescriptionList } from "@/components/ui/primitives";
import { formatDate, formatDateTime } from "@/lib/format";
import { DEMO_REQUEST_STATUS, EMAIL_STATUS } from "@/lib/labels";
import { getAuthContext } from "@/server/auth/session";
import { FLEET_SIZES, organizationNameFrom } from "@/server/domain/site";
import { DEMO_DURATIONS } from "@/server/domain/tenants";
import { loadOr404 } from "@/server/pages";
import { defaultTrialDays, getDemoRequest } from "@/server/services/demo-requests";
import { isPlatformAdmin } from "@/server/services/platform";
import { deleteDemoRequestAction, demoRequestDecisionAction } from "../../actions";
import { SiteAdminNav } from "../../site-admin-nav";

export const metadata = { title: "Demande de démonstration" };

const FLEET = Object.fromEntries(FLEET_SIZES.map((f) => [f.value, f.label]));
const DURATION_OPTIONS = DEMO_DURATIONS.map((d) => ({ value: String(d), label: `${d} jours` }));

export default async function DemoRequestPage(props: PageProps<"/administration/site/demandes/[id]">) {
  const ctx = await getAuthContext();
  if (!isPlatformAdmin(ctx)) return <Forbidden what="l'administration du site" />;
  const { id } = await props.params;
  const { request: r, decidedBy, existingAccount, tenant, passwordChanged, lastAccessEmail } = await loadOr404(id, (x) => getDemoRequest(ctx, x));
  const trialDays = await defaultTrialDays();
  const status = DEMO_REQUEST_STATUS[r.status];

  return (
    <>
      <PageHeader
        back={{ href: "/administration/site/demandes", label: "Demandes de démonstration" }}
        title={r.company}
        description={`Demande reçue le ${formatDateTime(r.createdAt)}.`}
        actions={<Badge tone={status?.tone ?? "gray"}>{status?.label ?? r.status}</Badge>}
      />
      <SiteAdminNav active="demandes" />

      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <Card>
          <CardHeader title="Prospect" />
          <CardBody>
            <DescriptionList
              items={[
                { label: "Société", value: r.company },
                { label: "Contact", value: r.contactName },
                { label: "Fonction", value: r.jobTitle ?? "—" },
                {
                  label: "Courriel (identifiant)",
                  value: (
                    <a href={`mailto:${r.email}`} className="text-brand-700 hover:underline">
                      {r.email}
                    </a>
                  ),
                },
                { label: "Téléphone", value: r.phone ? <a href={`tel:${r.phone.replace(/\s/g, "")}`}>{r.phone}</a> : "—" },
                { label: "Taille du parc", value: r.fleetSize ? FLEET[r.fleetSize] : "—" },
                { label: "Secteur", value: r.sector ?? "—" },
                { label: "Offre consultée", value: r.planInterest ?? "—" },
                { label: "Accord (confidentialité)", value: formatDateTime(r.consentAt) },
              ]}
            />
            {r.message ? (
              <blockquote className="mt-5 whitespace-pre-line rounded-md border-l-4 border-brand-500 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                {r.message}
              </blockquote>
            ) : null}
          </CardBody>
        </Card>

        <ActionPanel action={demoRequestDecisionAction.bind(null, r.id)} className="space-y-6">
          {r.status === "PENDING" ? (
            <>
              {existingAccount ? (
                <Alert tone="red" title="Un compte existe déjà avec ce courriel">
                  L&apos;acceptation est impossible avec ce courriel : refuser la demande ou contacter le prospect.
                </Alert>
              ) : null}
              <Card>
                <CardHeader
                  title="Accepter"
                  description="Ouvre l'organisation de démonstration et envoie au prospect le lien de connexion, son identifiant et un mot de passe provisoire."
                />
                <CardBody>
                  <PanelForm className="space-y-4">
                    <input type="hidden" name="intent" value="approve" />
                    <Field label="Organisation" name="organizationName" required>
                      <Input name="organizationName" required maxLength={120} defaultValue={organizationNameFrom(r.company)} />
                    </Field>
                    <Field label="Nom du contact (compte de direction)" name="adminName" required>
                      <Input name="adminName" required maxLength={120} defaultValue={r.contactName} />
                    </Field>
                    <Field label="Durée de la démonstration" name="durationDays" required>
                      <Select name="durationDays" required defaultValue={String(trialDays)} options={DURATION_OPTIONS} />
                    </Field>
                    <SubmitButton pendingLabel="Ouverture…">Accepter et envoyer les accès</SubmitButton>
                  </PanelForm>
                </CardBody>
              </Card>
              <Card>
                <CardHeader title="Refuser" />
                <CardBody>
                  <PanelForm className="space-y-4">
                    <input type="hidden" name="intent" value="reject" />
                    <Field label="Motif" name="reason" hint="Repris dans le courriel si le prospect est prévenu">
                      <Textarea name="reason" maxLength={1000} rows={3} />
                    </Field>
                    <Checkbox name="notify" label="Prévenir le prospect par courriel" defaultChecked />
                    <div>
                      <SubmitButton variant="secondary">Refuser la demande</SubmitButton>
                    </div>
                  </PanelForm>
                </CardBody>
              </Card>
            </>
          ) : (
            <Card>
              <CardHeader title="Décision" />
              <CardBody className="space-y-4">
                <DescriptionList
                  columns={1}
                  items={[
                    {
                      label: "Décision",
                      value: `${status?.label ?? r.status} le ${formatDateTime(r.decidedAt)}${decidedBy ? ` par ${decidedBy}` : ""}`,
                    },
                    ...(r.decisionNote ? [{ label: "Motif", value: r.decisionNote }] : []),
                    ...(tenant
                      ? [
                          {
                            label: "Organisation",
                            value: (
                              <Link href={`/administration/plateforme/${tenant.id}`} className="text-brand-700 hover:underline">
                                {tenant.name}
                              </Link>
                            ),
                          },
                          {
                            label: "Accès",
                            value: tenant.access.allowed
                              ? tenant.access.demo
                                ? `Démonstration jusqu'au ${formatDate(tenant.access.demo.endsAt)} (${tenant.access.demo.daysLeft} j)`
                                : "Abonnement actif"
                              : tenant.access.reason === "SUSPENDED"
                                ? "Suspendue"
                                : "Démonstration échue",
                          },
                          {
                            label: "Mot de passe",
                            value: passwordChanged ? "Choisi par le client (première connexion faite)" : "Provisoire (pas encore de connexion)",
                          },
                        ]
                      : []),
                    ...(lastAccessEmail
                      ? [
                          {
                            label: "Courriel d'accès",
                            value: `${EMAIL_STATUS[lastAccessEmail.status]?.label ?? lastAccessEmail.status}${lastAccessEmail.sentAt ? ` le ${formatDateTime(lastAccessEmail.sentAt)}` : ""}${lastAccessEmail.lastError ? ` — ${lastAccessEmail.lastError}` : ""}`,
                          },
                        ]
                      : []),
                  ]}
                />
                {r.status === "APPROVED" && passwordChanged === false ? (
                  <PanelForm>
                    <input type="hidden" name="intent" value="resend" />
                    <SubmitButton variant="secondary">Renvoyer les accès (nouveau mot de passe provisoire)</SubmitButton>
                  </PanelForm>
                ) : null}
              </CardBody>
            </Card>
          )}
          <Card>
            <CardHeader
              title="Effacer la demande"
              description="Droit à l'effacement : la demande disparaît ; une organisation déjà ouverte n'est pas touchée."
            />
            <CardBody>
              <ActionForm action={deleteDemoRequestAction.bind(null, r.id)}>
                <SubmitButton variant="danger" pendingLabel="Effacement…">
                  Effacer définitivement
                </SubmitButton>
              </ActionForm>
            </CardBody>
          </Card>
        </ActionPanel>
      </div>
    </>
  );
}
