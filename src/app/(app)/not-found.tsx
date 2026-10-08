import { ButtonLink } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-lg rounded-lg border border-slate-200 bg-white p-8 text-center">
      <h1 className="text-lg font-semibold text-slate-900">Page introuvable</h1>
      <p className="mt-2 text-sm text-slate-500">L&apos;élément demandé n&apos;existe pas ou n&apos;est pas dans votre périmètre.</p>
      <ButtonLink href="/" variant="secondary" className="mt-6">
        Retour au tableau de bord
      </ButtonLink>
    </div>
  );
}
