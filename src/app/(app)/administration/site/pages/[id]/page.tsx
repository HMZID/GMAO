import { ExternalLink } from "lucide-react";
import { Forbidden } from "@/components/forbidden";
import { ActionForm, Field, SubmitButton } from "@/components/forms/action-form";
import { PageHeader } from "@/components/layout/page-header";
import { Checkbox, Input, Textarea } from "@/components/ui/inputs";
import { Alert, Card, CardBody } from "@/components/ui/primitives";
import { getAuthContext } from "@/server/auth/session";
import { loadOr404 } from "@/server/pages";
import { isPlatformAdmin } from "@/server/services/platform";
import { getSitePage } from "@/server/services/site";
import { deleteSitePageAction, updateSitePageAction } from "../../actions";
import { SiteAdminNav } from "../../site-admin-nav";

export const metadata = { title: "Page du site" };

export default async function SitePageEditor(props: PageProps<"/administration/site/pages/[id]">) {
  const ctx = await getAuthContext();
  if (!isPlatformAdmin(ctx)) return <Forbidden what="l'administration du site" />;
  const { id } = await props.params;
  const page = await loadOr404(id, (x) => getSitePage(ctx, x));

  return (
    <>
      <PageHeader
        back={{ href: "/administration/site/pages", label: "Pages du site" }}
        title={page.title}
        actions={
          page.published ? (
            <a
              href={`/infos/${page.slug}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-sm font-medium text-brand-700 hover:underline"
            >
              Voir la page
              <ExternalLink className="h-3.5 w-3.5" aria-hidden />
            </a>
          ) : null
        }
      />
      <SiteAdminNav active="pages" />
      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <Card>
          <CardBody>
            <ActionForm action={updateSitePageAction.bind(null, page.id)} className="grid gap-4 md:grid-cols-2">
              <Field label="Titre" name="title" required>
                <Input name="title" required maxLength={120} defaultValue={page.title} />
              </Field>
              <Field label="Adresse" name="slug" hint={`Servie sous /infos/${page.slug}`}>
                <Input name="slug" maxLength={80} defaultValue={page.slug} pattern="[a-z0-9]+(-[a-z0-9]+)*" />
              </Field>
              <Field label="Résumé" name="summary" hint="Chapeau de la page et description pour les moteurs de recherche" className="md:col-span-2">
                <Input name="summary" maxLength={300} defaultValue={page.summary ?? ""} />
              </Field>
              <Field label="Texte" name="body" className="md:col-span-2">
                <Textarea name="body" rows={18} maxLength={20000} defaultValue={page.body} className="font-mono" />
              </Field>
              <div className="flex flex-wrap gap-6 md:col-span-2">
                <Checkbox name="published" label="Publiée" defaultChecked={page.published} />
                <Checkbox name="showInFooter" label="Lien dans le pied de page" defaultChecked={page.showInFooter} />
              </div>
              <div className="md:col-span-2">
                <SubmitButton>Enregistrer</SubmitButton>
              </div>
            </ActionForm>
          </CardBody>
        </Card>
        <div className="space-y-6">
          <Alert tone="blue" title="Mise en forme">
            <ul className="mt-1 list-disc space-y-1 pl-5">
              <li>« ## Titre » ou « ### Sous-titre » en début de ligne</li>
              <li>« - élément » pour une liste</li>
              <li>une ligne vide entre deux paragraphes</li>
              <li>**gras** et [texte du lien](https://…)</li>
            </ul>
          </Alert>
          <Card>
            <CardBody>
              <ActionForm action={deleteSitePageAction.bind(null, page.id)}>
                <SubmitButton variant="danger" pendingLabel="Suppression…">
                  Supprimer la page
                </SubmitButton>
              </ActionForm>
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
