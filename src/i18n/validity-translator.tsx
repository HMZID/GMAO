"use client";

import { useEffect } from "react";
import { useT } from "./client";
import { tpl } from "./translate";

type Control = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

const isControl = (target: EventTarget | null): target is Control =>
  target instanceof HTMLInputElement || target instanceof HTMLSelectElement || target instanceof HTMLTextAreaElement;

/** Message du contrôle natif d'un champ (obligatoire, format, longueur, bornes), en texte source français. */
export function validityMessage(control: Control): string {
  const v = control.validity;
  const input = control instanceof HTMLInputElement ? control : null;
  if (v.valueMissing) {
    if (input?.type === "checkbox") return "Cocher cette case pour continuer";
    if (input?.type === "file") return "Choisir un fichier";
    if (control instanceof HTMLSelectElement || input?.type === "radio") return "Choisir une valeur dans la liste";
    return "Champ obligatoire";
  }
  if (v.typeMismatch) {
    if (input?.type === "email") return "Adresse courriel invalide";
    if (input?.type === "url") return "Adresse web invalide (https://…)";
    return "Format invalide";
  }
  if (v.badInput) {
    if (input?.type === "number") return "Nombre attendu";
    if (input && ["date", "datetime-local", "month", "week"].includes(input.type)) return "Date attendue";
    if (input?.type === "time") return "Heure invalide";
    return "Valeur invalide";
  }
  if (v.tooShort && "minLength" in control) return tpl`${control.minLength} caractères au minimum`;
  if (v.tooLong && "maxLength" in control) return tpl`${control.maxLength} caractères au maximum`;
  if (v.rangeUnderflow && input) return tpl`Doit être supérieur ou égal à ${input.min}`;
  if (v.rangeOverflow && input) return tpl`Doit être inférieur ou égal à ${input.max}`;
  if (v.stepMismatch && input) return tpl`Valeur à saisir par pas de ${input.step}`;
  if (v.patternMismatch) return input?.title || "Format invalide";
  return "Valeur invalide";
}

/**
 * Bulles du contrôle natif des formulaires (champ obligatoire vide, courriel mal formé, valeur hors bornes…) :
 * le navigateur les écrit dans sa propre langue ; ce composant les remplace par le message de la langue choisie
 * dans l'application, pour tous les formulaires du document.
 */
export function ValidityTranslator() {
  const t = useT();

  useEffect(() => {
    const onInvalid = (event: Event) => {
      const control = event.target;
      if (!isControl(control)) return;
      control.setCustomValidity("");
      if (!control.validity.valid) control.setCustomValidity(t(validityMessage(control)));
    };
    // Une saisie efface le message : le contrôle suivant repart de l'état réel du champ.
    const onEdit = (event: Event) => {
      if (isControl(event.target)) event.target.setCustomValidity("");
    };
    // Avant chaque envoi (clic ou touche Entrée), les messages posés sont retirés : un champ rempli par le code,
    // sans saisie, n'est jamais bloqué par un ancien message.
    const clearForm = (form: HTMLFormElement | null | undefined) => {
      for (const element of Array.from(form?.elements ?? [])) if (isControl(element)) element.setCustomValidity("");
    };
    const onClick = (event: Event) => {
      const button = (event.target as Element | null)?.closest?.("button, input[type=submit]") as HTMLButtonElement | HTMLInputElement | null;
      if (button && button.type === "submit") clearForm(button.form);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Enter" && event.target instanceof HTMLInputElement) clearForm(event.target.form);
    };
    document.addEventListener("invalid", onInvalid, true);
    document.addEventListener("input", onEdit, true);
    document.addEventListener("change", onEdit, true);
    document.addEventListener("click", onClick, true);
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("invalid", onInvalid, true);
      document.removeEventListener("input", onEdit, true);
      document.removeEventListener("change", onEdit, true);
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("keydown", onKey, true);
    };
  }, [t]);

  return null;
}
