"use client";

import { ActionForm, Field, SubmitButton } from "@/components/forms/action-form";
import { Input } from "@/components/ui/inputs";
import { signInAction } from "../actions";
import { Turnstile } from "./turnstile";

export function LoginForm({ next, captchaSiteKey }: { next?: string; captchaSiteKey?: string | null }) {
  return (
    <ActionForm action={signInAction} className="space-y-4">
      <input type="hidden" name="next" value={next ?? "/"} />
      <Field label="Courriel" name="email" required>
        <Input id="email" name="email" type="email" autoComplete="username" required autoFocus />
      </Field>
      <Field label="Mot de passe" name="password" required>
        <Input id="password" name="password" type="password" autoComplete="current-password" required />
      </Field>
      {captchaSiteKey ? <Turnstile siteKey={captchaSiteKey} action="login" /> : null}
      <SubmitButton className="w-full" pendingLabel="Connexion…">
        Se connecter
      </SubmitButton>
    </ActionForm>
  );
}
