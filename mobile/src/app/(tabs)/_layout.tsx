import { Redirect, Tabs } from "expo-router";
import { Text, View, type ColorValue } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, Loading } from "../../components/ui";
import { SyncBanner } from "../../components/sync-banner";
import { useSession } from "../../context/session";

const icon = (glyph: string) =>
  function TabIcon({ color }: { color: ColorValue }) {
    return <Text style={{ color, fontSize: 20 }}>{glyph}</Text>;
  };

/**
 * Onglets selon les droits de l'utilisateur, les mêmes que sur le web (MOB-01) : un conducteur ne voit pas
 * les OT à exécuter, un magasinier ne voit pas les échéances.
 */
export default function TabsLayout() {
  const { state, can } = useSession();
  if (state.status === "loading") return <Loading />;
  if (state.status === "signedOut") return <Redirect href="/login" />;

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: colors.brand }}>
      <SyncBanner />
      <View style={{ flex: 1 }}>
        <Tabs
          screenOptions={{
            headerShown: false,
            tabBarActiveTintColor: colors.brand,
            tabBarLabelStyle: { fontSize: 12, fontWeight: "600" },
            tabBarStyle: { minHeight: 60 },
          }}
        >
          <Tabs.Screen name="index" options={{ title: "Mes OT", tabBarIcon: icon("🛠"), href: can("workorder.read") ? undefined : null }} />
          <Tabs.Screen name="equipment" options={{ title: "Équipements", tabBarIcon: icon("🚜"), href: can("equipment.read") ? undefined : null }} />
          <Tabs.Screen name="due" options={{ title: "Échéances", tabBarIcon: icon("📅"), href: can("plan.read") ? undefined : null }} />
          <Tabs.Screen name="scan" options={{ title: "Scanner", tabBarIcon: icon("▣") }} />
          <Tabs.Screen name="sync" options={{ title: "Synchro", tabBarIcon: icon("⟳") }} />
        </Tabs>
      </View>
    </SafeAreaView>
  );
}
