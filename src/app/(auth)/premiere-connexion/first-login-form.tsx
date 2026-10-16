"use client";

import { ActionForm, Field, SubmitButton } from "@/components/forms/action-form";
import { Input } from "@/components/ui/inputs";
import { setInitialPasswordAction } from "../actions";

export function FirstLoginForm({ email }: { email: string }) {
  return (
    <ActionForm action={setInitialPasswordAction} className="space-y-4">
      {/* Identifiant pour le gestionnaire de mots de passe du navigateur. */}
      <input type="email" name="username" value={email} autoComplete="username" readOnly hidden />
      <Field label="Nouveau mot de passe" name="password" required hint="10 caractères au moins">
        <Input id="password" name="password" type="password" autoComplete="new-password" required minLength={10} autoFocus />
      </Field>
      <Field label="Confirmation" name="confirmation" required>
        <Input id="confirmation" name="confirmation" type="password" autoComplete="new-password" required minLength={10} />
      </Field>
      <SubmitButton className="w-full" pendingLabel="Enregistrement…">
        Enregistrer et continuer
      </SubmitButton>
    </ActionForm>
  );
}
