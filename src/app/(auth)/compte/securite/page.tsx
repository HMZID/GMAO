import { ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ActionForm, Field, SubmitButton } from "@/components/forms/action-form";
import { Input } from "@/components/ui/inputs";
import { Skeleton } from "@/components/ui/primitives";
import { getOwnAuthContext } from "@/server/auth/session";
import { adminTwoFactorEnforced } from "@/server/domain/two-factor";
import { needsAdminTwoFactorSetup } from "@/server/services/platform";
import { disableTwoFactorAction } from "../actions";
import { RegenerateBackupCodes, TwoFactorEnrollment } from "./two-factor-setup";

export const metadata: Metadata = { title: "Sécurité du compte" };

/**
 * Double authentification du compte connecté (TEC-04), obligatoire pour l'administrateur de la plateforme.
 * Hors du groupe (app) : sa mise en page renverrait ici un administrateur sans double authentification.
 */
async function AccountSecurity({ searchParams }: { searchParams: PageProps<"/compte/securite">["searchParams"] }) {
  const ctx = await getOwnAuthContext();
  const justEnabled = (await searchParams).active === "1";
  const required = needsAdminTwoFactorSetup(ctx);
  const adminLocked =
    ctx.can("platform.manage") && adminTwoFactorEnforced({ flag: process.env.ADMIN_TWO_FACTOR_REQUIRED, vercelEnv: process.env.VERCEL_ENV });
  const continueHref = ctx.can("platform.manage") ? "/administration/plateforme" : "/";
  if (!ctx.twoFactorEnabled) {
    return (
      <div className="space-y-4">
        {required ? (
          <p role="alert" className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">
            Obligatoire pour l&apos;administrateur de la plateforme : vos droits de plateforme sont suspendus jusqu&apos;à l&apos;activation.
          </p>
        ) : (
          <p className="text-sm text-slate-600">
            Un code de votre téléphone sera demandé à chaque connexion, en plus du mot de passe. L&apos;application mobile GMAO ne gère pas encore ce
            code : ne l&apos;activez pas sur un compte utilisé sur le terrain.
          </p>
        )}
        <TwoFactorEnrollment />
      </div>
    );
  }
  return (
    <div className="space-y-6">
      <p role="status" className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-800">
        {justEnabled ? "Double authentification activée. " : "Double authentification active : "}
        un code de votre application est demandé à chaque connexion.
      </p>
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-900">Codes de secours</h2>
        <RegenerateBackupCodes />
      </section>
      {adminLocked ? null : (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-slate-900">Désactiver</h2>
          <ActionForm action={disableTwoFactorAction} className="space-y-3">
            <Field label="Mot de passe actuel" name="password" required>
              <Input name="password" type="password" autoComplete="current-password" required />
            </Field>
            <SubmitButton variant="secondary" className="w-full">
              Désactiver la double authentification
            </SubmitButton>
          </ActionForm>
        </section>
      )}
      <Link href={continueHref} className="block text-center text-sm text-brand-700 hover:underline">
        Retour à l&apos;application
      </Link>
    </div>
  );
}

export default function AccountSecurityPage(props: PageProps<"/compte/securite">) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-ink-900 px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center justify-center gap-2 text-white">
          <span className="flex h-9 w-9 items-center justify-center rounded-md bg-brand-600">
            <ShieldCheck className="h-5 w-5" aria-hidden />
          </span>
          <span className="text-xl font-semibold">GMAO</span>
        </div>
        <div className="rounded-lg bg-white p-6 shadow-xl">
          <h1 className="mb-4 text-lg font-semibold text-slate-900">Sécurité du compte</h1>
          <Suspense
            fallback={
              <div className="space-y-4" aria-busy="true" aria-label="Chargement">
                <Skeleton className="h-10" />
                <Skeleton className="h-10" />
              </div>
            }
          >
            <AccountSecurity searchParams={props.searchParams} />
          </Suspense>
        </div>
      </div>
    </main>
  );
}
