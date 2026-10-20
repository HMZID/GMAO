import { ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/primitives";
import { safeRedirectPath } from "@/server/domain/login-security";
import { TwoFactorForm } from "./two-factor-form";
import { T } from "@/i18n/client";

export const metadata: Metadata = { title: "Vérification" };

async function VerificationForm({ searchParams }: { searchParams: PageProps<"/connexion/verification">["searchParams"] }) {
  const sp = await searchParams;
  return <TwoFactorForm next={safeRedirectPath(typeof sp.next === "string" ? sp.next : "/")} />;
}

/** Deuxième étape de la connexion (TEC-04) : code de l'application d'authentification ou code de secours. */
export default function VerificationPage(props: PageProps<"/connexion/verification">) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-ink-900 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center justify-center gap-2 text-white">
          <span className="flex h-9 w-9 items-center justify-center rounded-md bg-brand-600">
            <ShieldCheck className="h-5 w-5" aria-hidden />
          </span>
          <span className="text-xl font-semibold">GMAO</span>
        </div>
        <div className="rounded-lg bg-white p-6 shadow-xl">
          <h1 className="text-lg font-semibold text-slate-900">
            <T>Vérification en deux étapes</T>
          </h1>
          <p className="mb-5 mt-1 text-sm text-slate-500">
            <T>Saisissez le code à 6 chiffres affiché par votre application d&apos;authentification.</T>
          </p>
          <Suspense
            fallback={
              <div className="space-y-4" aria-busy="true" aria-label="Chargement du formulaire">
                <Skeleton className="h-14" />
                <Skeleton className="h-10" />
              </div>
            }
          >
            <VerificationForm searchParams={props.searchParams} />
          </Suspense>
        </div>
        <p className="mt-4 text-center text-xs text-slate-400">
          <a href="/login" className="underline">
            <T>Reprendre la connexion</T>
          </a>
        </p>
      </div>
    </main>
  );
}
