"use client";

import {
  cloneElement,
  createContext,
  isValidElement,
  startTransition,
  use,
  useActionState,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from "react";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/inputs";
import { initialActionState, type ActionState } from "@/lib/action-state";
import { cn } from "@/lib/utils";
import { T, Tr, useT } from "@/i18n/client";

type FormContext = {
  state: ActionState;
  pending: boolean;
  /** Champs affichés (nom → libellé) : leurs erreurs sont sous le champ, les autres dans le message du formulaire. */
  fields?: Readonly<Record<string, string>>;
  register?: (name: string, label: string) => () => void;
};

const FormStateContext = createContext<FormContext>({ state: initialActionState, pending: false });

export function useActionFormState() {
  return use(FormStateContext);
}

/** Registre des champs d'un formulaire (ou d'un panneau de formulaires). */
function useFieldRegistry() {
  const [fields, setFields] = useState<Record<string, string>>({});
  const register = useCallback((name: string, label: string) => {
    setFields((current) => (current[name] === label ? current : { ...current, [name]: label }));
    return () =>
      setFields((current) => {
        if (!(name in current)) return current;
        const next = { ...current };
        delete next[name];
        return next;
      });
  }, []);
  return { fields, register };
}

/** Déclare un champ affiché hors de `Field` (case à cocher d'accord…) : son erreur n'est pas répétée en tête. */
export function useRegisterField(name: string, label: string) {
  const { register } = useActionFormState();
  useEffect(() => register?.(name, label), [register, name, label]);
}

/** Après un refus, le premier champ en erreur prend le focus (et devient visible). */
function focusFirstInvalid(root: HTMLElement | null, state: ActionState) {
  if (state.status !== "error" || !state.fieldErrors || !root) return;
  const invalid = root.querySelector<HTMLElement>('[aria-invalid="true"]');
  invalid?.focus({ preventScroll: false });
}

type Action = (state: ActionState, formData: FormData) => Promise<ActionState>;

/**
 * Formulaire relié à une Server Action.
 * - Une fois la page hydratée, la soumission passe par startTransition : les saisies sont conservées
 *   en cas d'erreur (pas de réinitialisation automatique) ; `resetOnSuccess` vide le formulaire après succès.
 * - Avant l'hydratation (réseau lent, JavaScript bloqué), `action` assure l'amélioration progressive :
 *   le navigateur envoie un POST vers la Server Action, jamais un GET qui exposerait les champs dans l'URL.
 */
export function ActionForm({
  action,
  children,
  className,
  resetOnSuccess = false,
  showMessage = true,
  onSuccess,
}: {
  action: Action;
  children: ReactNode;
  className?: string;
  resetOnSuccess?: boolean;
  showMessage?: boolean;
  onSuccess?: (state: ActionState) => void;
}) {
  const [state, formAction, pending] = useActionState(action, initialActionState);
  const formRef = useRef<HTMLFormElement>(null);
  const { fields, register } = useFieldRegistry();

  useEffect(() => {
    focusFirstInvalid(formRef.current, state);
    if (state.status === "success") {
      if (resetOnSuccess) formRef.current?.reset();
      onSuccess?.(state);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <FormStateContext value={{ state, pending, fields, register }}>
      <form
        ref={formRef}
        action={formAction}
        className={className}
        onSubmit={(event) => {
          event.preventDefault();
          // Le bouton cliqué (name/value) est inclus, comme lors d'une soumission native.
          const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
          const formData = new FormData(event.currentTarget, submitter);
          startTransition(() => formAction(formData));
        }}
      >
        {showMessage ? <FormMessage /> : null}
        {children}
      </form>
    </FormStateContext>
  );
}

export function FormMessage({ className }: { className?: string }) {
  const { state, fields = {} } = useActionFormState();
  const t = useT();
  if (state.status === "idle") return null;
  // Erreurs par champ : celles d'un champ affiché sont sous le champ (rappel de son libellé ici), les autres
  // (champ absent ou nommé autrement) sont listées pour qu'aucune ne reste invisible.
  const fieldErrors = Object.entries(state.fieldErrors ?? {}).filter(([, messages]) => messages?.length);
  const shownLabels = [...new Set(fieldErrors.filter(([name]) => name in fields).map(([name]) => t(fields[name])))];
  const unshown = fieldErrors.filter(([name]) => !(name in fields)).flatMap(([, messages]) => messages ?? []);
  if (state.status === "success" && !state.message && !state.warnings?.length) return null;
  const isError = state.status === "error";
  return (
    <div
      role={isError ? "alert" : "status"}
      className={cn(
        "mb-4 rounded-md border px-3 py-2 text-sm",
        isError ? "border-red-200 bg-red-50 text-red-900" : "border-emerald-200 bg-emerald-50 text-emerald-900",
        className,
      )}
    >
      {state.message ? (
        <p className="font-medium">
          <Tr>{state.message}</Tr>
        </p>
      ) : null}
      {state.secret ? (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <code
            data-secret
            className="min-w-0 flex-1 break-all rounded bg-white px-2 py-1.5 font-mono text-xs text-slate-900 ring-1 ring-emerald-200"
          >
            {state.secret}
          </code>
          <button
            type="button"
            className="rounded px-2 py-1 text-xs font-medium ring-1 ring-emerald-300 hover:bg-emerald-100"
            onClick={() => void navigator.clipboard?.writeText(state.secret ?? "")}
          >
            <T>Copier</T>
          </button>
        </div>
      ) : null}
      {shownLabels.length ? (
        <p className="mt-1">
          {t("Champs à corriger :")} {shownLabels.join(", ")}
        </p>
      ) : null}
      {unshown.length ? (
        <ul className="mt-1 list-disc space-y-0.5 ps-5">
          {[...new Set(unshown)].map((e) => (
            <li key={e}>
              <Tr>{e}</Tr>
            </li>
          ))}
        </ul>
      ) : null}
      {state.errors?.length ? (
        <ul className="mt-1 list-disc space-y-0.5 ps-5">
          {state.errors.map((e) => (
            <li key={e}>
              <Tr>{e}</Tr>
            </li>
          ))}
        </ul>
      ) : null}
      {state.warnings?.length ? (
        <ul className="mt-1 list-disc space-y-0.5 ps-5 text-amber-900">
          {state.warnings.map((w) => (
            <li key={w}>
              <Tr>{w}</Tr>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/** Contrôles qui transmettent `required` à l'élément natif (champ, liste, zone de texte). */
function acceptsRequired(element: ReactElement) {
  const type = element.type as unknown;
  if (typeof type === "string") return ["input", "select", "textarea"].includes(type);
  return type === Input || type === Select || type === Textarea;
}

/**
 * Champ de formulaire : libellé relié au contrôle (identifiant du contrôle enfant, sinon `name`),
 * aide ou erreur de validation du champ, signalée aux technologies d'assistance.
 */
export function Field({
  label,
  name,
  hint,
  required,
  children,
  className,
}: {
  label: string;
  name: string;
  hint?: string;
  required?: boolean;
  children: ReactNode;
  className?: string;
}) {
  const { state, register } = useActionFormState();
  const error = state.fieldErrors?.[name]?.[0];
  useEffect(() => register?.(name, label), [register, name, label]);
  // Identifiant unique dans le document : les pages précédentes restent montées (masquées) par le
  // routeur, un identifiant fixe pourrait relier le libellé au champ d'une autre page.
  const uid = useId();
  const child = isValidElement<{ id?: string; required?: boolean }>(children) ? children : null;
  // Obligatoire si le champ ou son contrôle le dit : astérisque, contrôle natif du navigateur et annonce d'accessibilité.
  const isRequired = !!required || !!child?.props.required;
  const controlId = child ? `${child.props.id ?? name}${uid}` : name;
  const messageId = `${controlId}-message`;
  const labelContent = (
    <>
      <Tr>{label}</Tr>
      {isRequired ? (
        <span className="text-red-600" aria-hidden>
          {" "}
          *
        </span>
      ) : null}
    </>
  );
  const control = child
    ? cloneElement(child as ReactElement<Record<string, unknown>>, {
        id: controlId,
        ...(isRequired && acceptsRequired(child) ? { required: true } : {}),
        "aria-invalid": error ? true : undefined,
        "aria-describedby": error || hint ? messageId : undefined,
      })
    : children;
  return (
    <div className={cn("space-y-1", className)}>
      {child ? (
        <>
          <label htmlFor={controlId} className="block text-sm font-medium text-slate-700">
            {labelContent}
          </label>
          {control}
        </>
      ) : (
        // Champ reçu sous une forme qui ne peut pas recevoir d'identifiant (élément différé du flux serveur) :
        // le libellé l'englobe, ce qui garde l'association.
        <label className="block space-y-1">
          <span className="block text-sm font-medium text-slate-700">{labelContent}</span>
          {control}
        </label>
      )}
      {error ? (
        <p id={messageId} className="text-xs text-red-700" role="alert">
          <Tr>{error}</Tr>
        </p>
      ) : hint ? (
        <p id={messageId} className="text-xs text-slate-500">
          <Tr>{hint}</Tr>
        </p>
      ) : null}
    </div>
  );
}

export function SubmitButton({
  children,
  variant = "primary",
  size = "md",
  className,
  name,
  value,
  pendingLabel = "Enregistrement…",
}: {
  children: ReactNode;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md";
  className?: string;
  name?: string;
  value?: string;
  /** Texte affiché pendant l'envoi. */
  pendingLabel?: string;
}) {
  const { pending } = useActionFormState();
  return (
    <Button type="submit" variant={variant} size={size} disabled={pending} className={className} name={name} value={value}>
      {pending ? <Tr>{pendingLabel}</Tr> : children}
    </Button>
  );
}

/* ------------------------------------------------------------------ */
/* Panneau d'actions : plusieurs formulaires, un seul état partagé       */
/* ------------------------------------------------------------------ */

const PanelContext = createContext<((formData: FormData) => void) | null>(null);

/**
 * Regroupe plusieurs formulaires reliés à la même Server Action (ex. transitions d'un OT).
 * Le message de résultat est porté par le panneau : il reste affiché même quand le formulaire
 * soumis disparaît après le rafraîchissement (la transition effectuée n'est plus proposée).
 */
export function ActionPanel({ action, children, className }: { action: Action; children: ReactNode; className?: string }) {
  const [state, formAction, pending] = useActionState(action, initialActionState);
  const { fields, register } = useFieldRegistry();
  const panelRef = useRef<HTMLDivElement>(null);
  useEffect(() => focusFirstInvalid(panelRef.current, state), [state]);
  return (
    <FormStateContext value={{ state, pending, fields, register }}>
      <PanelContext value={formAction}>
        <div ref={panelRef} className={className}>
          <FormMessage />
          {children}
        </div>
      </PanelContext>
    </FormStateContext>
  );
}

/** Formulaire d'un ActionPanel (même comportement que ActionForm, état partagé). */
export function PanelForm({ children, className }: { children: ReactNode; className?: string }) {
  const dispatch = use(PanelContext);
  if (!dispatch) throw new Error("PanelForm doit être placé dans un ActionPanel.");
  return (
    <form
      action={dispatch}
      className={className}
      onSubmit={(event) => {
        event.preventDefault();
        const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
        const formData = new FormData(event.currentTarget, submitter);
        startTransition(() => dispatch(formData));
      }}
    >
      {children}
    </form>
  );
}
