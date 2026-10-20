"use client";

import { Button } from "@/components/ui/button";
import { T, Tr } from "@/i18n/client";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const forbidden = error.message.includes("non autorisée");
  return (
    <div className="mx-auto max-w-lg rounded-lg border border-slate-200 bg-white p-8 text-center">
      <h1 className="text-lg font-semibold text-slate-900">
        <Tr>{forbidden ? "Accès refusé" : "Une erreur est survenue"}</Tr>
      </h1>
      <p className="mt-2 text-sm text-slate-500">
        <Tr>{forbidden ? "Cette page ou cette donnée est hors de votre périmètre." : error.message || "Réessayer dans un instant."}</Tr>
      </p>
      {error.digest ? (
        <p className="mt-2 font-mono text-xs text-slate-400">
          <T params={{ digest: error.digest }}>{"Réf. {digest}"}</T>
        </p>
      ) : null}
      <Button className="mt-6" variant="secondary" onClick={reset}>
        <T>Réessayer</T>
      </Button>
    </div>
  );
}
