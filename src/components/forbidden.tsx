import { ButtonLink } from "@/components/ui/button";

/** Affiché quand l'utilisateur n'a pas le droit requis par la page (CDC §2.2). */
export function Forbidden({ what = "cette page" }: { what?: string }) {
  return (
    <div className="mx-auto max-w-lg rounded-lg border border-slate-200 bg-white p-8 text-center">
      <h1 className="text-lg font-semibold text-slate-900">Accès refusé</h1>
      <p className="mt-2 text-sm text-slate-500">Votre rôle ne donne pas accès à {what}. Contacter l&apos;administrateur si nécessaire.</p>
      <ButtonLink href="/" variant="secondary" className="mt-6">
        Retour au tableau de bord
      </ButtonLink>
    </div>
  );
}
