import { Pressable, Text, View } from "react-native";
import { LOCALES, LOCALE_NAMES } from "../i18n/config";
import { useLocale } from "../i18n";
import { colors } from "./ui";

/** Choix de la langue de l'application : français, anglais ou arabe (l'arabe change le sens d'écriture au redémarrage). */
export function LanguageSwitcher() {
  const { locale, setLocale } = useLocale();
  return (
    <View style={{ flexDirection: "row", gap: 8 }}>
      {LOCALES.map((code) => {
        const selected = code === locale;
        return (
          <Pressable
            key={code}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            onPress={() => void setLocale(code)}
            style={{
              flex: 1,
              minHeight: 48,
              borderRadius: 10,
              alignItems: "center",
              justifyContent: "center",
              borderWidth: 2,
              borderColor: selected ? colors.brand : colors.border,
              backgroundColor: selected ? "#ccfbf1" : "#fff",
            }}
          >
            <Text style={{ fontSize: 16, fontWeight: "700", color: colors.text }}>{LOCALE_NAMES[code]}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}
