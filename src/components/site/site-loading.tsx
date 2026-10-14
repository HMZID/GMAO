import { SiteFallback } from "./site-chrome";

/** Chargement d'une page du site commercial (frontière <Suspense> des navigations entre pages). */
export default function SiteLoading() {
  return <SiteFallback />;
}
