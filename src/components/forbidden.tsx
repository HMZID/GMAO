import { ButtonLink } from "@/components/ui/button";
import { T } from "@/i18n/client";

/** Affiché quand l'utilisateur n'a pas le droit requis par la page (CDC §2.2). */
export function Forbidden({ what = "cette page" }: { what?: string }) {
  return (
    <div className="mx-auto max-w-lg rounded-lg border border-slate-200 bg-white p-8 text-center">
      <h1 className="text-lg font-semibold text-slate-900">
        <T>Accès refusé</T>
      </h1>
      <p className="mt-2 text-sm text-slate-500">
        <T params={{ what: what }}>{"Votre rôle ne donne pas accès à {what}. Contacter l'administrateur si nécessaire."}</T>
      </p>
      <ButtonLink href="/" variant="secondary" className="mt-6">
        <T>Retour au tableau de bord</T>
      </ButtonLink>
    </div>
  );
}
