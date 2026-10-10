"use client";

import { useEffect, useRef } from "react";

/**
 * Placé dans un <details open> : le replie au chargement sur téléphone (le contenu reste accessible sans
 * JavaScript, ouvert par défaut) et signale les filtres en cours (paramètres de l'adresse) sur le résumé.
 */
export function CollapseOnMobile() {
  const marker = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const details = marker.current?.closest("details");
    if (!details) return;
    const params = [...new URLSearchParams(window.location.search).keys()].filter((k) => k !== "page");
    const badge = details.querySelector<HTMLElement>("[data-active-filters]");
    if (badge) badge.classList.toggle("hidden", params.length === 0);
    if (window.matchMedia("(max-width: 767.98px)").matches) details.open = false;
  }, []);
  return <span ref={marker} hidden />;
}
