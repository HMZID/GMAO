import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, use, useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Alert, I18nManager } from "react-native";
import { DEFAULT_LOCALE, isLocale, localeFromDevice, type Locale } from "./config";
import { setFormatLocale } from "./current";
import { dictionaryOf } from "./dictionaries";
import { translate, type Params } from "./translate";

const STORAGE_KEY = "gmao.locale";

type I18nValue = { locale: Locale; setLocale: (locale: Locale) => Promise<void>; t: (source: string, params?: Params) => string };

const I18nContext = createContext<I18nValue | null>(null);

function deviceLocale() {
  try {
    return localeFromDevice(Intl.DateTimeFormat().resolvedOptions().locale);
  } catch {
    return DEFAULT_LOCALE;
  }
}

/**
 * Langue de l'application : choisie par l'utilisateur (mémorisée sur l'appareil), sinon celle de l'appareil.
 * L'arabe s'écrit de droite à gauche : le sens de l'interface ne change qu'au redémarrage de l'application
 * (limite de React Native), l'utilisateur en est prévenu.
 */
export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      let chosen: Locale = deviceLocale();
      try {
        const saved = await AsyncStorage.getItem(STORAGE_KEY);
        if (isLocale(saved)) chosen = saved;
      } catch {
        // Stockage indisponible : langue de l'appareil.
      }
      setFormatLocale(chosen);
      I18nManager.allowRTL(true);
      setLocaleState(chosen);
      setReady(true);
    })();
  }, []);

  const setLocale = useCallback(async (next: Locale) => {
    setFormatLocale(next);
    setLocaleState(next);
    await AsyncStorage.setItem(STORAGE_KEY, next).catch(() => undefined);
    const rtl = next === "ar";
    if (I18nManager.isRTL !== rtl) {
      I18nManager.forceRTL(rtl);
      const dictionary = dictionaryOf(next);
      Alert.alert(
        translate(dictionary, "Redémarrage nécessaire"),
        translate(dictionary, "Fermez puis rouvrez l'application pour appliquer le sens d'écriture."),
      );
    }
  }, []);

  const value = useMemo<I18nValue>(() => {
    const dictionary = dictionaryOf(locale);
    return { locale, setLocale, t: (source, params) => translate(dictionary, source, params) };
  }, [locale, setLocale]);

  if (!ready) return null;
  return <I18nContext value={value}>{children}</I18nContext>;
}

function useI18n() {
  const value = use(I18nContext);
  if (!value) throw new Error("useT doit être utilisé dans I18nProvider.");
  return value;
}

/** Fonction de traduction : `const t = useT(); t("Se connecter")`. */
export function useT() {
  return useI18n().t;
}

export function useLocale() {
  const { locale, setLocale } = useI18n();
  return { locale, setLocale };
}
