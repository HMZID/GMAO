import { Wrench } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/primitives";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Connexion" };

async function LoginFormWithNext({ searchParams }: { searchParams: PageProps<"/login">["searchParams"] }) {
  const sp = await searchParams;
  const next = typeof sp.next === "string" ? sp.next : undefined;
  return <LoginForm next={next} />;
}

export default function LoginPage(props: PageProps<"/login">) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-ink-900 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center justify-center gap-2 text-white">
          <span className="flex h-9 w-9 items-center justify-center rounded-md bg-brand-600">
            <Wrench className="h-5 w-5" aria-hidden />
          </span>
          <span className="text-xl font-semibold">GMAO</span>
        </div>
        <div className="rounded-lg bg-white p-6 shadow-xl">
          <h1 className="text-lg font-semibold text-slate-900">Connexion</h1>
          <p className="mb-5 mt-1 text-sm text-slate-500">Maintenance des engins, véhicules et équipements.</p>
          {/* Le formulaire dépend de « next » (URL) : en attendant, un gabarit non soumissible évite de perdre la page demandée. */}
          <Suspense fallback={<LoginFormSkeleton />}>
            <LoginFormWithNext searchParams={props.searchParams} />
          </Suspense>
        </div>
        <p className="mt-4 text-center text-xs text-slate-400">Les comptes sont créés par l&apos;administrateur.</p>
      </div>
    </main>
  );
}

function LoginFormSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Chargement du formulaire">
      <Skeleton className="h-14" />
      <Skeleton className="h-14" />
      <Skeleton className="h-10" />
    </div>
  );
}
