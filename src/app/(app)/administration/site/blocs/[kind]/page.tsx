import { ArrowDown, ArrowUp } from "lucide-react";
import { notFound } from "next/navigation";
import { Forbidden } from "@/components/forbidden";
import { ActionForm, Field, SubmitButton } from "@/components/forms/action-form";
import { PageHeader } from "@/components/layout/page-header";
import { SITE_ICON_LABELS, SiteIcon } from "@/components/site/site-icon";
import { Disclosure } from "@/components/ui/disclosure";
import { Checkbox, Input, Select, Textarea } from "@/components/ui/inputs";
import { Badge, Card, EmptyState } from "@/components/ui/primitives";
import { getAuthContext } from "@/server/auth/session";
import { SITE_ICONS, SITE_ITEM_KIND_DEFINITIONS, type SiteItemKind } from "@/server/domain/site";
import { isPlatformAdmin } from "@/server/services/platform";
import { listSiteItems } from "@/server/services/site";
import { createSiteItemAction, deleteSiteItemAction, moveSiteItemAction, updateSiteItemAction } from "../../actions";
import { KIND_SLUGS, SiteAdminNav, kindFromSlug } from "../../site-admin-nav";
import { T, Tr } from "@/i18n/client";
import { tpl } from "@/i18n/translate";

export const metadata = { title: "Blocs du site" };

const ICON_OPTIONS = SITE_ICONS.map((i) => ({ value: i, label: SITE_ICON_LABELS[i] }));

type Item = Awaited<ReturnType<typeof listSiteItems>>[number];

/** Champs d'un bloc selon son type (libellés propres à chaque type). */
function ItemFields({ kind, item }: { kind: SiteItemKind; item?: Item }) {
  const f = SITE_ITEM_KIND_DEFINITIONS[kind].fields;
  return (
    <>
      <Field label={f.title} name="title" required>
        <Input name="title" required maxLength={160} defaultValue={item?.title} />
      </Field>
      {f.meta ? (
        <Field label={f.meta} name="meta">
          <Input name="meta" maxLength={160} defaultValue={item?.meta ?? ""} />
        </Field>
      ) : null}
      {f.icon ? (
        <Field label="Icône" name="icon">
          <Select name="icon" placeholder="Aucune" defaultValue={item?.icon ?? ""} options={ICON_OPTIONS} />
        </Field>
      ) : null}
      {f.body ? (
        <Field label={f.body} name="body" className="md:col-span-2">
          <Textarea name="body" maxLength={2000} rows={3} defaultValue={item?.body ?? ""} />
        </Field>
      ) : null}
      <div className="md:col-span-2">
        <Checkbox name="published" label="Publié sur le site" defaultChecked={item ? item.published : true} />
      </div>
    </>
  );
}

export default async function SiteItemsPage(props: PageProps<"/administration/site/blocs/[kind]">) {
  const ctx = await getAuthContext();
  if (!isPlatformAdmin(ctx)) return <Forbidden what="l'administration du site" />;
  const kind = kindFromSlug((await props.params).kind);
  if (!kind) notFound();
  const def = SITE_ITEM_KIND_DEFINITIONS[kind];
  const items = await listSiteItems(ctx, kind);

  return (
    <>
      <PageHeader
        back={{ href: "/administration", label: "Administration" }}
        title="Site commercial"
        description={`${def.plural} : ${def.description}`}
      />
      <SiteAdminNav active={KIND_SLUGS[kind]} />

      <Disclosure summary={tpl`Ajouter : ${def.label.toLowerCase()}`} className="mb-6">
        <ActionForm action={createSiteItemAction.bind(null, kind)} resetOnSuccess className="grid gap-4 md:grid-cols-2">
          <ItemFields kind={kind} />
          <div className="md:col-span-2">
            <SubmitButton>
              <T>Ajouter</T>
            </SubmitButton>
          </div>
        </ActionForm>
      </Disclosure>

      {items.length === 0 ? (
        <Card>
          <EmptyState title={tpl`Aucun bloc « ${def.plural} »`} description="La rubrique est masquée sur le site tant qu'elle est vide." />
        </Card>
      ) : (
        <ol className="space-y-3">
          {items.map((item, i) => (
            <li key={item.id}>
              <Card className="p-4">
                <div className="flex flex-wrap items-start gap-3">
                  {def.fields.icon ? (
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-amber-100 text-slate-900">
                      <SiteIcon name={item.icon} className="h-5 w-5" />
                    </span>
                  ) : null}
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-slate-900">
                      <Tr>{item.title}</Tr>
                      {item.meta ? (
                        <span className="ms-2 text-sm font-normal text-slate-500">
                          <Tr>{item.meta}</Tr>
                        </span>
                      ) : null}
                      {!item.published ? (
                        <Badge tone="gray" className="ms-2">
                          <T>Non publié</T>
                        </Badge>
                      ) : null}
                    </p>
                    {item.body ? (
                      <p className="mt-1 line-clamp-2 text-sm text-slate-600">
                        <Tr>{item.body}</Tr>
                      </p>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-1">
                    <ActionForm action={moveSiteItemAction.bind(null, item.id, "up")} showMessage={false}>
                      <button
                        type="submit"
                        disabled={i === 0}
                        className="rounded-md p-2 text-slate-600 hover:bg-slate-100 disabled:opacity-30"
                        aria-label={`Monter « ${item.title} »`}
                      >
                        <ArrowUp className="h-4 w-4" aria-hidden />
                      </button>
                    </ActionForm>
                    <ActionForm action={moveSiteItemAction.bind(null, item.id, "down")} showMessage={false}>
                      <button
                        type="submit"
                        disabled={i === items.length - 1}
                        className="rounded-md p-2 text-slate-600 hover:bg-slate-100 disabled:opacity-30"
                        aria-label={`Descendre « ${item.title} »`}
                      >
                        <ArrowDown className="h-4 w-4" aria-hidden />
                      </button>
                    </ActionForm>
                  </div>
                </div>
                <Disclosure summary="Modifier" className="mt-3">
                  <ActionForm action={updateSiteItemAction.bind(null, item.id)} className="grid gap-4 md:grid-cols-2">
                    <ItemFields kind={kind} item={item} />
                    <div className="md:col-span-2">
                      <SubmitButton>
                        <T>Enregistrer</T>
                      </SubmitButton>
                    </div>
                  </ActionForm>
                  <ActionForm action={deleteSiteItemAction.bind(null, item.id)} className="mt-4 border-t border-slate-100 pt-4">
                    <SubmitButton variant="danger" size="sm" pendingLabel="Suppression…">
                      <T>Supprimer</T>
                    </SubmitButton>
                  </ActionForm>
                </Disclosure>
              </Card>
            </li>
          ))}
        </ol>
      )}
    </>
  );
}
