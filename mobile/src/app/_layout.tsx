import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { colors } from "../components/ui";
import { I18nProvider, useT } from "../i18n";
import { SessionProvider } from "../context/session";
import { SyncProvider } from "../context/sync";

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <I18nProvider>
        <SessionProvider>
          <SyncProvider>
            <Navigation />
          </SyncProvider>
        </SessionProvider>
      </I18nProvider>
    </SafeAreaProvider>
  );
}

function Navigation() {
  const t = useT();
  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.brand },
          headerTintColor: "#fff",
          headerTitleStyle: { fontWeight: "700" },
          contentStyle: { backgroundColor: colors.bg },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="login" options={{ title: t("Connexion"), headerShown: false }} />
        <Stack.Screen name="equipment/[id]" options={{ title: t("Équipement") }} />
        <Stack.Screen name="work-order/[id]" options={{ title: t("Intervention à réaliser") }} />
        <Stack.Screen name="request/new" options={{ title: t("Créer une demande d'intervention") }} />
      </Stack>
    </>
  );
}
