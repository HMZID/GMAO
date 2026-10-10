"use client";

import { useEffect, useRef } from "react";

/**
 * Pose sur chaque cellule le libellé de sa colonne (attribut data-label), affiché devant la valeur quand le
 * tableau passe en cartes sur téléphone (globals.css, .table-cards). Les lignes ajoutées après un
 * rafraîchissement sont reprises. Les colonnes d'actions (en-tête masqué) n'ont pas de libellé.
 */
export function TableCardLabels() {
  const marker = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const table = marker.current?.previousElementSibling;
    if (!(table instanceof HTMLTableElement)) return;
    const apply = () => {
      const headers = [...table.querySelectorAll("thead th")].map((th) => (th.classList.contains("sr-only") ? "" : (th.textContent ?? "").trim()));
      for (const row of table.querySelectorAll("tbody tr")) {
        let column = 0;
        for (const cell of row.children) {
          if (!(cell instanceof HTMLTableCellElement)) continue;
          const label = headers[column] ?? "";
          if (cell.dataset.label !== label) cell.dataset.label = label;
          column += cell.colSpan || 1;
        }
      }
    };
    apply();
    const observer = new MutationObserver(apply);
    observer.observe(table, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  return <span ref={marker} hidden />;
}
