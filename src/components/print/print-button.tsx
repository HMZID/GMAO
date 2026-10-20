"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { T } from "@/i18n/client";

/** Ouvre la boîte d'impression du navigateur (impression papier ou PDF). */
export function PrintButton() {
  return (
    <Button type="button" onClick={() => window.print()}>
      <Printer className="h-4 w-4" aria-hidden />
      <T>Imprimer</T>
    </Button>
  );
}
