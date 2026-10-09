import Link from "next/link";
import { ActionForm, SubmitButton } from "@/components/forms/action-form";
import { Checkbox } from "@/components/ui/inputs";
import { PageHeader } from "@/components/layout/page-header";
import { Badge, Card, CardBody, CardHeader, EmptyState } from "@/components/ui/primitives";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { getAuthContext } from "@/server/auth/session";
import { getMyEmailPreferences, linkOf } from "@/server/services/email";
import { listMyNotifications } from "@/server/services/notifications";
import { markAllReadAction, updateEmailPreferencesAction } from "./actions";

export const metadata = { title: "Notifications" };

export default async function NotificationsPage() {
  const ctx = await getAuthContext();
  const [items, preferences] = await Promise.all([listMyNotifications(ctx, 50), getMyEmailPreferences(ctx)]);
  const unread = items.filter((n) => !n.readAt).length;

  return (
    <>
      <PageHeader
        title="Notifications"
        description="Alertes dans l'application selon vos rôles et votre périmètre (NOT-01, NOT-03), et par courriel selon vos préférences ci-dessous."
        actions={
          unread > 0 ? (
            <ActionForm action={markAllReadAction}>
              <SubmitButton variant="secondary">Tout marquer comme lu</SubmitButton>
            </ActionForm>
          ) : null
        }
      />
      <Card>
        {items.length === 0 ? (
          <EmptyState title="Aucune notification" />
        ) : (
          <ul className="divide-y divide-slate-100">
            {items.map((n) => {
              const href = linkOf(n.entityType, n.entityId);
              const urgent = n.type.endsWith("urgent");
              return (
                <li key={n.id} className={cn("flex flex-wrap items-start justify-between gap-3 px-5 py-3", !n.readAt && "bg-brand-50/40")}>
                  <div className="min-w-0">
                    <p className={cn("text-sm", n.readAt ? "text-slate-700" : "font-medium text-slate-900")}>
                      {urgent ? (
                        <Badge tone="red" className="mr-2">
                          Urgent
                        </Badge>
                      ) : null}
                      {href ? (
                        <Link href={href} className="hover:underline">
                          {n.title}
                        </Link>
                      ) : (
                        n.title
                      )}
                    </p>
                    {n.body ? <p className="mt-0.5 text-sm text-slate-500">{n.body}</p> : null}
                  </div>
                  <span className="whitespace-nowrap text-xs text-slate-500">{formatDateTime(n.createdAt)}</span>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <Card className="mt-6">
        <CardHeader
          title="Courriels"
          description="Événements reçus par courriel. Les alertes obligatoires ne peuvent pas être désactivées (§11.1)."
        />
        <CardBody>
          <ActionForm action={updateEmailPreferencesAction} className="space-y-4">
            <ul className="grid gap-3 sm:grid-cols-2">
              {preferences.map((p) => (
                <li key={p.event} className="rounded-md border border-slate-200 p-3">
                  {p.mandatory ? (
                    <>
                      {/* Case désactivée non envoyée par le navigateur : la valeur est portée par le champ caché. */}
                      <input type="hidden" name="enabled[]" value={p.event} />
                      <Checkbox label={`${p.label} (obligatoire)`} checked disabled readOnly />
                    </>
                  ) : (
                    <Checkbox name="enabled[]" value={p.event} label={p.label} defaultChecked={p.enabled} />
                  )}
                  <p className="mt-1 pl-6 text-xs text-slate-500">{p.description}</p>
                </li>
              ))}
            </ul>
            <SubmitButton>Enregistrer les préférences</SubmitButton>
          </ActionForm>
        </CardBody>
      </Card>
    </>
  );
}
