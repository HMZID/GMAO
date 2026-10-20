"use client";

import { useTransition } from "react";
import { LOCALES, LOCALE_NAMES, type Locale } from "@/i18n/config";
import { setLocaleAction } from "@/i18n/actions";
import { useLocale, useT } from "@/i18n/client";
import { cn } from "@/lib/utils";

/**
 * Choix de la langue (français, anglais, arabe). La langue est mémorisée dans un cookie puis la page est
 * rechargée : le sens d'écriture (gauche à droite, droite à gauche) change pour toute la mise en page.
 */
export function LanguageSwitcher({ tone = "light", className }: { tone?: "light" | "dark"; className?: string }) {
  const current = useLocale();
  const t = useT();
  const [pending, startTransition] = useTransition();

  function choose(locale: Locale) {
    if (locale === current) return;
    startTransition(async () => {
      await setLocaleAction(locale);
      window.location.reload();
    });
  }

  return (
    <div role="group" aria-label={t("Langue")} className={cn("inline-flex items-center gap-0.5 text-xs", pending && "opacity-60", className)}>
      {LOCALES.map((locale) => (
        <button
          key={locale}
          type="button"
          lang={locale}
          aria-pressed={locale === current}
          disabled={pending}
          onClick={() => choose(locale)}
          className={cn(
            "min-h-8 min-w-8 rounded px-2 py-1 font-medium transition-colors",
            tone === "dark"
              ? locale === current
                ? "bg-white/20 text-white"
                : "text-slate-300 hover:bg-white/10 hover:text-white"
              : locale === current
                ? "bg-slate-900 text-white"
                : "text-slate-600 hover:bg-slate-100",
          )}
        >
          {LOCALE_NAMES[locale]}
        </button>
      ))}
    </div>
  );
}
