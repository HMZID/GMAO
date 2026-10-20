import type { Locale } from "../config";
import type { Dictionary } from "../translate";
import { ar } from "./ar";
import { en } from "./en";

const EMPTY: Dictionary = {};

/** Dictionnaire d'une langue ; le français (langue source) n'en a pas besoin. */
export function dictionaryOf(locale: Locale): Dictionary {
  return locale === "en" ? en : locale === "ar" ? ar : EMPTY;
}
