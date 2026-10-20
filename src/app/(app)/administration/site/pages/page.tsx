import Link from "next/link";
import { Forbidden } from "@/components/forbidden";
import { ActionForm, Field, SubmitButton } from "@/components/forms/action-form";
import { PageHeader } from "@/components/layout/page-header";
import { Disclosure } from "@/components/ui/disclosure";
import { Input } from "@/components/ui/inputs";
import { Badge, Card, EmptyState, Table, TBody, TD, TH, THead, TR } from "@/components/ui/primitives";
import { formatDateTime } from "@/lib/format";
import { getAuthContext } from "@/server/auth/session";
import { isPlatformAdmin } from "@/server/services/platform";
import { listSitePages } from "@/server/services/site";
import { createSitePageAction } from "../actions";
import { SiteAdminNav } from "../site-admin-nav";

export const metadata = { title: "Pages du site" };

/** Pages libres du site (mentions légales, confidentialité, à propos…), servies sous /infos/<adresse>. */
export default async function SitePagesPage() {
  const ctx = await getAuthContext();
  if (!isPlatformAdmin(ctx)) return <Forbidden what="l'administration du site" />;
  const pages = await listSitePages(ctx);

  return (
    <>
      <PageHeader
        back={{ href: "/administration", label: "Administration" }}
        title="Site commercial"
        description="Pages libres, liées depuis le pied de page du site."
      />
      <SiteAdminNav active="pages" />
      <Disclosure summary="Nouvelle page" className="mb-6">
        <ActionForm action={createSitePageAction} className="grid gap-4 md:grid-cols-2">
          <Field label="Titre" name="title" required>
            <Input name="title" required maxLength={120} placeholder="Ex. : À propos" />
          </Field>
          <Field label="Adresse" name="slug" hint="Facultative : déduite du titre (ex. a-propos)">
            <Input name="slug" maxLength={80} pattern="[a-z0-9]+(-[a-z0-9]+)*" />
          </Field>
          <input type="hidden" name="published" value="" />
          <input type="hidden" name="showInFooter" value="on" />
          <div className="md:col-span-2">
            <SubmitButton>Créer et rédiger</SubmitButton>
          </div>
        </ActionForm>
      </Disclosure>
      <Card>
        {pages.length === 0 ? (
          <EmptyState title="Aucune page" />
        ) : (
          <Table>
            <THead>
              <tr>
                <TH>Page</TH>
                <TH>Adresse</TH>
                <TH>État</TH>
                <TH>Modifiée le</TH>
              </tr>
            </THead>
            <TBody>
              {pages.map((p) => (
                <TR key={p.id}>
                  <TD>
                    <Link href={`/administration/site/pages/${p.id}`} className="font-medium text-brand-700 hover:underline">
                      {p.title}
                    </Link>
                  </TD>
                  <TD className="font-mono text-xs">/infos/{p.slug}</TD>
                  <TD>
                    <Badge tone={p.published ? "green" : "gray"}>{p.published ? "Publiée" : "Brouillon"}</Badge>
                    {p.published && p.showInFooter ? <span className="ms-2 text-xs text-slate-500">pied de page</span> : null}
                  </TD>
                  <TD className="text-xs">{formatDateTime(p.updatedAt)}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </Card>
    </>
  );
}
