import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { useSync } from "../context/sync";
import { formatDateTime } from "../lib/labels";

/** Bandeau permanent (§10.3) : état de connexion, dernière synchronisation, saisies en attente ou à revoir. */
export function SyncBanner() {
  const { online, syncing, lastSyncAt, operations } = useSync();
  const pending = operations.filter((o) => o.status === "pending").length;
  const rejected = operations.filter((o) => o.status === "rejected").length;
  const bg = !online ? "#7f1d1d" : rejected ? "#78350f" : pending ? "#1e3a8a" : "#065f46";
  const text = !online
    ? `Hors connexion · ${pending} saisie(s) en attente`
    : syncing
      ? "Synchronisation…"
      : rejected
        ? `${rejected} saisie(s) à revoir`
        : pending
          ? `${pending} saisie(s) en attente d'envoi`
          : `Synchronisé${lastSyncAt ? ` · ${formatDateTime(lastSyncAt.toISOString())}` : ""}`;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`État de synchronisation : ${text}`} onPress={() => router.navigate("/sync")}>
      <View style={{ backgroundColor: bg, paddingVertical: 8, paddingHorizontal: 16 }}>
        <Text style={{ color: "#fff", fontSize: 14, fontWeight: "600" }}>{text}</Text>
      </View>
    </Pressable>
  );
}
