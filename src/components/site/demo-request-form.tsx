"use client";

import { ArrowRight, Mail } from "lucide-react";
import Link from "next/link";
import type { ComponentProps } from "react";
import { ActionForm, Field, useActionFormState } from "@/components/forms/action-form";
import { FLEET_SIZES, SECTORS } from "@/server/domain/site";
import { submitDemoRequestAction } from "@/app/(site)/essai-gratuit/actions";
import { T } from "@/i18n/client";

const control =
  "block w-full border-2 border-asphalt bg-white px-3 text-base text-asphalt placeholder:text-asphalt-500/60 focus:outline-none focus:ring-4 focus:ring-signal/60";

function TextInput(props: ComponentProps<"input">) {
  return <input {...props} className={`${control} h-12`} />;
}

function SelectInput({ options, ...props }: ComponentProps<"select"> & { options: { value: string; label: string }[] }) {
  return (
    <select {...props} className={`${control} h-12`}>
      <option value=""><T>Choisir…</T></option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

/**
 * Formulaire de demande d'essai. `startedAt` (heure d'affichage, fournie par le serveur) et le champ piège
 * « website » écartent les envois automatisés sans gêner les visiteurs.
 */
export function DemoRequestForm({
  startedAt,
  plans,
  plan,
  emailNotice,
}: {
  startedAt: number;
  plans: string[];
  plan?: string;
  /** Message annonçant le courriel d'accès envoyé à l'acceptation de la demande. */
  emailNotice?: string;
}) {
  return (
    <ActionForm action={submitDemoRequestAction} className="grid gap-5 sm:grid-cols-2">
      <input type="hidden" name="startedAt" value={startedAt} />
      <div className="absolute -start-[9999px] h-px w-px overflow-hidden" aria-hidden>
        <label>
          <T>Site web (ne pas remplir)</T>
          <input type="text" name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      <Field label="Société" name="company" required className="sm:col-span-2">
        <TextInput name="company" required maxLength={120} autoComplete="organization" placeholder="Ex. : Travaux Publics du Rhône" />
      </Field>
      <Field label="Nom et prénom" name="contactName" required>
        <TextInput name="contactName" required maxLength={120} autoComplete="name" />
      </Field>
      <Field label="Fonction" name="jobTitle">
        <TextInput name="jobTitle" maxLength={120} autoComplete="organization-title" placeholder="Ex. : Responsable maintenance" />
      </Field>
      <Field label="Courriel professionnel" name="email" required hint="Ce sera votre identifiant de connexion">
        <TextInput name="email" type="email" required maxLength={200} autoComplete="email" />
      </Field>
      <Field label="Téléphone" name="phone">
        <TextInput name="phone" type="tel" maxLength={40} autoComplete="tel" />
      </Field>
      <Field label="Taille du parc" name="fleetSize">
        <SelectInput name="fleetSize" options={FLEET_SIZES.map((f) => ({ value: f.value, label: f.label }))} />
      </Field>
      <Field label="Secteur" name="sector">
        <SelectInput name="sector" options={SECTORS.map((s) => ({ value: s, label: s }))} />
      </Field>
      {plans.length > 0 ? (
        <Field label="Offre qui vous intéresse" name="planInterest" className="sm:col-span-2">
          <SelectInput
            name="planInterest"
            defaultValue={plan && plans.includes(plan) ? plan : ""}
            options={plans.map((p) => ({ value: p, label: p }))}
          />
        </Field>
      ) : null}
      <Field label="Votre besoin en quelques mots" name="message" className="sm:col-span-2">
        <textarea
          name="message"
          rows={4}
          maxLength={2000}
          className={`${control} py-2`}
          placeholder="Ex. : 60 engins sur 3 sites, préventif aujourd'hui sur Excel…"
        />
      </Field>
      <Consent />
      {emailNotice ? (
        <p className="flex items-start gap-3 border-2 border-asphalt bg-signal/20 px-4 py-3 text-sm sm:col-span-2">
          <Mail className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
          <span>{emailNotice}</span>
        </p>
      ) : null}
      <div className="sm:col-span-2">
        <Submit />
      </div>
    </ActionForm>
  );
}

function Consent() {
  const { state } = useActionFormState();
  const error = state.fieldErrors?.consent?.[0];
  return (
    <div className="sm:col-span-2">
      <label className="flex items-start gap-3 text-sm">
        <input type="checkbox" name="consent" required aria-invalid={error ? true : undefined} className="mt-0.5 h-5 w-5 shrink-0 accent-asphalt" />
        <span>
          <T>J&apos;accepte que mes informations soient utilisées pour traiter ma demande et ouvrir mon espace de démonstration (</T>
          <Link href="/infos/confidentialite" className="underline">
            <T>confidentialité</T>
          </Link>
          ).
        </span>
      </label>
      {error ? (
        <p className="mt-1 text-xs text-red-700" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function Submit() {
  const { pending } = useActionFormState();
  return (
    <button type="submit" disabled={pending} className="site-btn site-btn-signal w-full text-base disabled:opacity-60">
      {pending ? "Envoi…" : "Demander mon espace de démonstration"}
      {pending ? null : <ArrowRight className="rtl-flip h-5 w-5" aria-hidden />}
    </button>
  );
}
