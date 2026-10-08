import { PageSkeleton } from "@/components/ui/primitives";

/**
 * État de chargement d'un segment de route. Chaque dossier de page a son `loading.tsx` : la frontière
 * <Suspense> couvre aussi les navigations entre pages voisines (liste → fiche → modification),
 * pour que la navigation reste instantanée avec Cache Components.
 */
export default function RouteLoading() {
  return <PageSkeleton />;
}
