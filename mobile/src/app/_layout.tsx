import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { colors } from "../components/ui";
import { SessionProvider } from "../context/session";
import { SyncProvider } from "../context/sync";

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <SessionProvider>
        <SyncProvider>
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
            <Stack.Screen name="login" options={{ title: "Connexion", headerShown: false }} />
            <Stack.Screen name="equipment/[id]" options={{ title: "Équipement" }} />
            <Stack.Screen name="work-order/[id]" options={{ title: "Ordre de travail" }} />
            <Stack.Screen name="request/new" options={{ title: "Signaler une panne" }} />
          </Stack>
        </SyncProvider>
      </SessionProvider>
    </SafeAreaProvider>
  );
}
