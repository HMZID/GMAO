"use client";

import type { ComponentProps } from "react";
import { Tr, useT } from "@/i18n/client";
import { cn } from "@/lib/utils";

/** Champs de saisie stylés, utilisables dans les composants serveur et client. */

const field =
  "block w-full rounded-md border-0 bg-white px-3 py-2 text-sm text-slate-900 shadow-xs ring-1 ring-inset ring-slate-300 placeholder:text-slate-400 focus:ring-2 focus:ring-inset focus:ring-brand-600 disabled:bg-slate-50 disabled:text-slate-500";

export function Input({ className, placeholder, ...props }: ComponentProps<"input">) {
  const t = useT();
  return <input className={cn(field, "h-10", className)} placeholder={placeholder ? t(placeholder) : placeholder} {...props} />;
}

export function Textarea({ className, rows = 3, placeholder, ...props }: ComponentProps<"textarea">) {
  const t = useT();
  return <textarea rows={rows} className={cn(field, className)} placeholder={placeholder ? t(placeholder) : placeholder} {...props} />;
}

export type Option = { value: string; label: string };

export function Select({ options, placeholder, className, ...props }: ComponentProps<"select"> & { options: Option[]; placeholder?: string }) {
  return (
    <select className={cn(field, "h-10 pe-8", className)} {...props}>
      {placeholder !== undefined ? (
        <option value="">
          <Tr>{placeholder}</Tr>
        </option>
      ) : null}
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          <Tr>{o.label}</Tr>
        </option>
      ))}
    </select>
  );
}

export function Checkbox({ label, className, ...props }: ComponentProps<"input"> & { label: string }) {
  return (
    <label className={cn("inline-flex items-center gap-2 text-sm text-slate-700", className)}>
      <input type="checkbox" className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-600" {...props} />
      <Tr>{label}</Tr>
    </label>
  );
}

export function Label({ className, ...props }: ComponentProps<"label">) {
  return <label className={cn("block text-sm font-medium text-slate-700", className)} {...props} />;
}
