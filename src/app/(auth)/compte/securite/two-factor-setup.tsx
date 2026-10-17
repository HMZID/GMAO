"use client";

import { useActionState, useId } from "react";
import { Input } from "@/components/ui/inputs";
import { confirmEnrollmentAction, regenerateBackupCodesAction, startEnrollmentAction, type EnrollmentState } from "../actions";

const idle: EnrollmentState = { status: "idle" };
const button =
  "inline-flex h-10 w-full items-center justify-center rounded-md bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60";

function Message({ state }: { state: EnrollmentState }) {
  if (!state.message && !state.errors?.length) return null;
  const error = state.status === "error";
  return (
    <div
      role={error ? "alert" : "status"}
      className={`rounded-md px-3 py-2 text-sm ${error ? "bg-red-50 text-red-800" : "bg-green-50 text-green-800"}`}
    >
      {state.message}
      {state.errors?.map((e) => (
        <p key={e}>{e}</p>
      ))}
    </div>
  );
}

function PasswordField() {
  const id = useId();
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-sm font-medium text-slate-700">
        Mot de passe actuel
      </label>
      <Input id={id} name="password" type="password" autoComplete="current-password" required />
    </div>
  );
}

function BackupCodes({ codes }: { codes: string[] }) {
  return (
    <div className="rounded-md border border-amber-300 bg-amber-50 p-3">
      <p className="text-sm font-medium text-amber-900">Codes de secours : notez-les et rangez-les en lieu sûr (un usage chacun).</p>
      <ul className="mt-2 grid grid-cols-2 gap-1 font-mono text-sm" aria-label="Codes de secours">
        {codes.map((c) => (
          <li key={c}>{c}</li>
        ))}
      </ul>
    </div>
  );
}

/** Activation : mot de passe, puis QR code et codes de secours, puis premier code de l'application. */
export function TwoFactorEnrollment() {
  const [started, start, starting] = useActionState(startEnrollmentAction, idle);
  const [confirmed, confirm, confirming] = useActionState(confirmEnrollmentAction, idle);
  const codeId = useId();

  if (started.qrSvg) {
    return (
      <div className="space-y-4">
        <ol className="list-decimal space-y-1 pl-5 text-sm text-slate-600">
          <li>Scannez ce QR code avec une application d&apos;authentification (Google Authenticator, Microsoft Authenticator…).</li>
          <li>Saisissez le code à 6 chiffres qu&apos;elle affiche.</li>
        </ol>
        {/* SVG produit par la bibliothèque qrcode à partir de l'URI otpauth : aucune donnée saisie. */}
        <div className="flex justify-center" aria-label="QR code d'activation" dangerouslySetInnerHTML={{ __html: started.qrSvg }} />
        <p className="text-center text-xs text-slate-500">
          Saisie manuelle :{" "}
          <span className="select-all font-mono text-slate-800" data-totp-secret>
            {started.secret}
          </span>
        </p>
        {started.backupCodes ? <BackupCodes codes={started.backupCodes} /> : null}
        <form action={confirm} className="space-y-3">
          <div className="space-y-1">
            <label htmlFor={codeId} className="block text-sm font-medium text-slate-700">
              Code de vérification
            </label>
            <Input id={codeId} name="code" inputMode="numeric" autoComplete="one-time-code" maxLength={7} required autoFocus />
          </div>
          <Message state={confirmed} />
          <button type="submit" disabled={confirming} className={button}>
            {confirming ? "Vérification…" : "Activer la double authentification"}
          </button>
        </form>
      </div>
    );
  }

  return (
    <form action={start} className="space-y-3">
      <p className="text-sm text-slate-600">Pour commencer, confirmez votre mot de passe.</p>
      <PasswordField />
      <Message state={started} />
      <button type="submit" disabled={starting} className={button}>
        {starting ? "Préparation…" : "Configurer l'application d'authentification"}
      </button>
    </form>
  );
}

/** Double authentification active : nouveaux codes de secours. */
export function RegenerateBackupCodes() {
  const [state, action, pending] = useActionState(regenerateBackupCodesAction, idle);
  return (
    <form action={action} className="space-y-3">
      <PasswordField />
      <Message state={state} />
      {state.backupCodes ? <BackupCodes codes={state.backupCodes} /> : null}
      <button type="submit" disabled={pending} className={button}>
        {pending ? "Génération…" : "Générer de nouveaux codes de secours"}
      </button>
    </form>
  );
}
