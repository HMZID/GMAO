"use client";

import { useEffect } from "react";
import { useLocale, useT } from "./client";

/**
 * Titre de l'onglet : les pages le déclarent en français (`metadata.title`, rendu côté serveur sans accès à la
 * langue). Ce composant traduit la partie propre à la page (avant « · GMAO ») dès qu'elle change.
 */
export function TitleTranslator() {
  const locale = useLocale();
  const t = useT();

  useEffect(() => {
    if (locale === "fr") return;
    const apply = () => {
      // Next remplace parfois l'élément <title> lors d'une navigation : on le relit à chaque changement.
      const title = document.querySelector("title");
      if (!title) return;
      const text = title.textContent ?? "";
      const [page, ...rest] = text.split(" · ");
      const translated = t(page.trim());
      if (translated === page.trim()) return;
      const next = [translated, ...rest].join(" · ");
      if (next !== text) title.textContent = next;
    };
    apply();
    const observer = new MutationObserver(apply);
    observer.observe(document.head, { childList: true, characterData: true, subtree: true });
    return () => observer.disconnect();
    // `t` est recréée à chaque rendu : la langue suffit comme dépendance.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locale]);

  return null;
}
