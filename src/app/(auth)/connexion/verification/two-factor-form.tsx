"use client";

import { useState } from "react";
import { ActionForm, Field, SubmitButton } from "@/components/forms/action-form";
import { Input } from "@/components/ui/inputs";
import { verifyTwoFactorAction } from "../../actions";

/** Code TOTP, ou code de secours si le téléphone n'est pas disponible. */
export function TwoFactorForm({ next }: { next: string }) {
  const [backup, setBackup] = useState(false);
  return (
    <div className="space-y-4">
      <ActionForm key={backup ? "backup" : "totp"} action={verifyTwoFactorAction} className="space-y-4">
        <input type="hidden" name="next" value={next} />
        <input type="hidden" name="method" value={backup ? "backup" : "totp"} />
        {backup ? (
          <Field label="Code de secours" name="code" required hint="Un des codes remis à l'activation ; chacun ne sert qu'une fois">
            <Input id="code" name="code" autoComplete="off" required autoFocus />
          </Field>
        ) : (
          <Field label="Code de vérification" name="code" required>
            <Input id="code" name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9 ]{6,7}" maxLength={7} required autoFocus />
          </Field>
        )}
        <SubmitButton className="w-full" pendingLabel="Vérification…">
          Vérifier et continuer
        </SubmitButton>
      </ActionForm>
      <button type="button" onClick={() => setBackup((b) => !b)} className="w-full text-center text-sm text-brand-700 hover:underline">
        {backup ? "Utiliser l'application d'authentification" : "Utiliser un code de secours"}
      </button>
    </div>
  );
}
