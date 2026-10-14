import type { Metadata } from "next";
import { connection } from "next/server";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { RichText } from "@/components/site/sections";
import { SiteChrome, SiteFallback } from "@/components/site/site-chrome";
import { loadSite } from "@/components/site/site-data";
import { formatDate } from "@/lib/format";
import { getPublicPage } from "@/server/services/site";

export async function generateMetadata(props: PageProps<"/infos/[slug]">): Promise<Metadata> {
  await connection();
  const { slug } = await props.params;
  const [page, site] = await Promise.all([getPublicPage(slug), loadSite()]);
  if (!page) return { title: "Page introuvable" };
  return {
    title: { absolute: `${page.title} · ${site.settings["brand.name"]}` },
    description: page.summary ?? undefined,
    alternates: { canonical: `/infos/${page.slug}` },
  };
}

/** Page libre du site (mentions légales, confidentialité…), rédigée dans l'administration. */
export default function InfoPage(props: PageProps<"/infos/[slug]">) {
  return (
    <Suspense fallback={<SiteFallback />}>
      <Info params={props.params} />
    </Suspense>
  );
}

async function Info({ params }: { params: PageProps<"/infos/[slug]">["params"] }) {
  const { slug } = await params;
  const [site, page] = await Promise.all([loadSite(), getPublicPage(slug)]);
  if (!page) notFound();
  return (
    <SiteChrome site={site}>
      <article>
        <header className="site-blueprint bg-asphalt text-white">
          <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
            <p className="site-label text-signal">[ Informations ]</p>
            <h1 className="site-display mt-4 text-5xl sm:text-6xl">{page.title}</h1>
            {page.summary ? <p className="mt-5 text-lg text-white/70">{page.summary}</p> : null}
            <p className="site-label mt-6 text-[11px] text-white/50">Mise à jour le {formatDate(page.updatedAt)}</p>
          </div>
        </header>
        <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
          <RichText source={page.body} />
        </div>
      </article>
    </SiteChrome>
  );
}
