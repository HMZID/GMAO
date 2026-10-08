"use client";

import { Button } from "@/components/ui/button";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const forbidden = error.message.includes("non autorisée");
  return (
    <div className="mx-auto max-w-lg rounded-lg border border-slate-200 bg-white p-8 text-center">
      <h1 className="text-lg font-semibold text-slate-900">{forbidden ? "Accès refusé" : "Une erreur est survenue"}</h1>
      <p className="mt-2 text-sm text-slate-500">
        {forbidden ? "Cette page ou cette donnée est hors de votre périmètre." : error.message || "Réessayer dans un instant."}
      </p>
      {error.digest ? <p className="mt-2 font-mono text-xs text-slate-400">Réf. {error.digest}</p> : null}
      <Button className="mt-6" variant="secondary" onClick={reset}>
        Réessayer
      </Button>
    </div>
  );
}
