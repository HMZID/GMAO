import Link from "next/link";
import { ActionForm, SubmitButton } from "@/components/forms/action-form";
import { PageHeader } from "@/components/layout/page-header";
import { Badge, Card, EmptyState } from "@/components/ui/primitives";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { getAuthContext } from "@/server/auth/session";
import { listMyNotifications } from "@/server/services/notifications";
import { markAllReadAction } from "./actions";

export const metadata = { title: "Notifications" };

const LINKS: Record<string, string> = {
  work_request: "/demandes/",
  work_order: "/ordres-de-travail/",
  equipment: "/equipements/",
};

export default async function NotificationsPage() {
  const ctx = await getAuthContext();
  const items = await listMyNotifications(ctx, 50);
  const unread = items.filter((n) => !n.readAt).length;

  return (
    <>
      <PageHeader
        title="Notifications"
        description="Alertes dans l'application selon vos rôles et votre périmètre (NOT-01, NOT-03). Courriel et notifications mobiles : itération suivante."
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
              const href = n.entityType && n.entityId && LINKS[n.entityType] ? `${LINKS[n.entityType]}${n.entityId}` : null;
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
    </>
  );
}
