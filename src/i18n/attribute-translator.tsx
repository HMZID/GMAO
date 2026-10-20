"use client";

import { useEffect } from "react";
import { useLocale, useT } from "./client";

const ATTRIBUTES = ["aria-label", "placeholder", "title"] as const;
const SELECTOR = ATTRIBUTES.map((name) => `[${name}]`).join(",");

/**
 * Attributs lus par les lecteurs d'écran et les infobulles (aria-label, placeholder, title) : les composants les
 * déclarent en français, ce composant les traduit dans le document dès qu'ils apparaissent ou changent. Sans effet en
 * français (les noms accessibles restent ceux que testent les parcours de bout en bout).
 */
export function AttributeTranslator() {
  const locale = useLocale();
  const t = useT();

  useEffect(() => {
    if (locale === "fr") return;
    const translateElement = (element: Element) => {
      for (const name of ATTRIBUTES) {
        const value = element.getAttribute(name);
        if (!value) continue;
        const translated = t(value);
        if (translated !== value) element.setAttribute(name, translated);
      }
    };
    const translateTree = (root: Element) => {
      translateElement(root);
      root.querySelectorAll(SELECTOR).forEach(translateElement);
    };
    translateTree(document.body);
    const observer = new MutationObserver((records) => {
      for (const record of records) {
        if (record.type === "attributes" && record.target instanceof Element) translateElement(record.target);
        else record.addedNodes.forEach((node) => node instanceof Element && translateTree(node));
      }
    });
    observer.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: [...ATTRIBUTES] });
    return () => observer.disconnect();
    // `t` est recréée à chaque rendu : la langue suffit comme dépendance.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locale]);

  return null;
}
