"use client";

import {
  cloneElement,
  createContext,
  isValidElement,
  startTransition,
  use,
  useActionState,
  useEffect,
  useId,
  useRef,
  type ReactElement,
  type ReactNode,
} from "react";
import { Button } from "@/components/ui/button";
import { initialActionState, type ActionState } from "@/lib/action-state";
import { cn } from "@/lib/utils";

type FormContext = { state: ActionState; pending: boolean };

const FormStateContext = createContext<FormContext>({ state: initialActionState, pending: false });

export function useActionFormState() {
  return use(FormStateContext);
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

  useEffect(() => {
    if (state.status === "success") {
      if (resetOnSuccess) formRef.current?.reset();
      onSuccess?.(state);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <FormStateContext value={{ state, pending }}>
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
  const { state } = useActionFormState();
  if (state.status === "idle") return null;
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
      {state.message ? <p className="font-medium">{state.message}</p> : null}
      {state.errors?.length ? (
        <ul className="mt-1 list-disc space-y-0.5 pl-5">
          {state.errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      ) : null}
      {state.warnings?.length ? (
        <ul className="mt-1 list-disc space-y-0.5 pl-5 text-amber-900">
          {state.warnings.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
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
  const { state } = useActionFormState();
  const error = state.fieldErrors?.[name]?.[0];
  // Identifiant unique dans le document : les pages précédentes restent montées (masquées) par le
  // routeur, un identifiant fixe pourrait relier le libellé au champ d'une autre page.
  const uid = useId();
  const child = isValidElement<{ id?: string }>(children) ? children : null;
  const controlId = child ? `${child.props.id ?? name}${uid}` : name;
  const messageId = `${controlId}-message`;
  const control = child
    ? cloneElement(child as ReactElement<Record<string, unknown>>, {
        id: controlId,
        "aria-invalid": error ? true : undefined,
        "aria-describedby": error || hint ? messageId : undefined,
      })
    : children;
  return (
    <div className={cn("space-y-1", className)}>
      <label htmlFor={controlId} className="block text-sm font-medium text-slate-700">
        {label}
        {required ? (
          <span className="text-red-600" aria-hidden>
            {" "}
            *
          </span>
        ) : null}
      </label>
      {control}
      {error ? (
        <p id={messageId} className="text-xs text-red-700" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p id={messageId} className="text-xs text-slate-500">
          {hint}
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
}: {
  children: ReactNode;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md";
  className?: string;
  name?: string;
  value?: string;
}) {
  const { pending } = useActionFormState();
  return (
    <Button type="submit" variant={variant} size={size} disabled={pending} className={className} name={name} value={value}>
      {pending ? "Enregistrement…" : children}
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
  return (
    <FormStateContext value={{ state, pending }}>
      <PanelContext value={formAction}>
        <div className={className}>
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
