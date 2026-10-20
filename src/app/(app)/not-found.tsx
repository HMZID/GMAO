import { ButtonLink } from "@/components/ui/button";
import { T } from "@/i18n/client";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-lg rounded-lg border border-slate-200 bg-white p-8 text-center">
      <h1 className="text-lg font-semibold text-slate-900">
        <T>Page introuvable</T>
      </h1>
      <p className="mt-2 text-sm text-slate-500">
        <T>L&apos;élément demandé n&apos;existe pas ou n&apos;est pas dans votre périmètre.</T>
      </p>
      <ButtonLink href="/" variant="secondary" className="mt-6">
        <T>Retour au tableau de bord</T>
      </ButtonLink>
    </div>
  );
}
