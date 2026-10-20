import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Tr } from "@/i18n/client";

export function PageHeader({
  title,
  description,
  actions,
  back,
  meta,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  back?: { href: string; label: string };
  meta?: ReactNode;
}) {
  return (
    <div className="mb-5 sm:mb-6">
      {back ? (
        <Link href={back.href} className="mb-2 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800">
          <ChevronLeft className="rtl-flip h-4 w-4" aria-hidden />
          <Tr>{back.label}</Tr>
        </Link>
      ) : null}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">
            <Tr>{title}</Tr>
          </h1>
          {description ? (
            <p className="mt-1 max-w-3xl text-sm text-slate-500">
              <Tr>{description}</Tr>
            </p>
          ) : null}
          {meta ? (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Tr>{meta}</Tr>
            </div>
          ) : null}
        </div>
        {/* Téléphone : boutons d'action pleine largeur, faciles à toucher. */}
        {actions ? (
          <div className="flex flex-wrap items-center gap-2 max-sm:w-full max-sm:*:flex-1">
            <Tr>{actions}</Tr>
          </div>
        ) : null}
      </div>
    </div>
  );
}
