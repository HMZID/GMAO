"use client";

import { cloneElement, isValidElement, useId, type ReactElement, type ReactNode } from "react";

/**
 * Libellé compact au-dessus d'un champ de filtre. L'identifiant du champ est rendu unique dans le
 * document (les pages déjà visitées restent montées, masquées, par le routeur).
 */
export function FilterField({ label, htmlFor, children, className }: { label: string; htmlFor: string; children: ReactNode; className?: string }) {
  const uid = useId();
  const id = `${htmlFor}${uid}`;
  const control = isValidElement(children) ? cloneElement(children as ReactElement<Record<string, unknown>>, { id }) : children;
  return (
    <div className={className ?? "w-44"}>
      <label htmlFor={id} className="mb-1 block text-xs font-medium text-slate-500">
        {label}
      </label>
      {control}
    </div>
  );
}
