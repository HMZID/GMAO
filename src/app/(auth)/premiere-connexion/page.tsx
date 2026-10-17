import { KeyRound } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/primitives";
import { getOwnAuthContext } from "@/server/auth/session";
import { FirstLoginForm } from "./first-login-form";

export const metadata: Metadata = { title: "Première connexion" };

/** Compte ouvert depuis le site : le mot de passe provisoire reçu par courriel est remplacé avant tout. */
async function FirstLogin() {
  const ctx = await getOwnAuthContext();
  if (!ctx.mustChangePassword) redirect("/");
  return (
    <>
      <p className="mb-5 mt-1 text-sm text-slate-500">
        Bienvenue {ctx.name}. Choisissez votre mot de passe personnel : le mot de passe provisoire reçu par courriel ne servira plus.
      </p>
      <FirstLoginForm email={ctx.email} />
    </>
  );
}

export default function FirstLoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-ink-900 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center justify-center gap-2 text-white">
          <span className="flex h-9 w-9 items-center justify-center rounded-md bg-brand-600">
            <KeyRound className="h-5 w-5" aria-hidden />
          </span>
          <span className="text-xl font-semibold">GMAO</span>
        </div>
        <div className="rounded-lg bg-white p-6 shadow-xl">
          <h1 className="text-lg font-semibold text-slate-900">Première connexion</h1>
          <Suspense
            fallback={
              <div className="mt-4 space-y-4" aria-busy="true" aria-label="Chargement du formulaire">
                <Skeleton className="h-10" />
                <Skeleton className="h-14" />
                <Skeleton className="h-14" />
              </div>
            }
          >
            <FirstLogin />
          </Suspense>
        </div>
      </div>
    </main>
  );
}
