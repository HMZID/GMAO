import { Alert, Text, View } from "react-native";
import { Badge, Button, Card, Message, Screen, styles } from "../../components/ui";
import { useSession } from "../../context/session";
import { useSync } from "../../context/sync";
import { formatDateTime } from "../../lib/labels";
import { describeOperation } from "../../lib/sync";

/**
 * Synchronisation contrôlée (MOB-07 à MOB-09) : saisies en attente, saisies refusées par le serveur avec leur
 * motif (à relancer ou abandonner, jamais supprimées d'office), synchronisation à la demande, déconnexion.
 */
export default function SyncScreen() {
  const { state, signOut } = useSession();
  const { online, syncing, lastSyncAt, lastResult, operations, syncNow, retry, discard } = useSync();
  const rejected = operations.filter((o) => o.status === "rejected");
  const pending = operations.filter((o) => o.status === "pending");

  function confirmSignOut() {
    const warn =
      operations.length > 0 ? `${operations.length} saisie(s) non envoyée(s) resteront sur l'appareil jusqu'à la prochaine connexion.` : "";
    Alert.alert("Se déconnecter ?", `Les données consultées seront effacées de l'appareil. ${warn}`, [
      { text: "Annuler", style: "cancel" },
      { text: "Se déconnecter", style: "destructive", onPress: () => void signOut() },
    ]);
  }

  return (
    <Screen>
      <Card title="État">
        <Text style={styles.text}>Connexion : {online ? "en ligne" : "hors connexion"}</Text>
        <Text style={styles.text}>Dernière synchronisation : {lastSyncAt ? formatDateTime(lastSyncAt.toISOString()) : "—"}</Text>
        {lastResult?.error ? <Message tone="amber">{lastResult.error}</Message> : null}
        <Button title="Synchroniser maintenant" onPress={() => void syncNow()} busy={syncing} disabled={!online || operations.length === 0} />
      </Card>

      {rejected.length > 0 ? (
        <Card title={`À revoir (${rejected.length})`}>
          <Text style={styles.muted}>Le serveur a refusé ces saisies. Corriger la situation puis relancer, ou abandonner la saisie.</Text>
          {rejected.map((op) => (
            <View key={op.clientId} style={{ gap: 8, borderTopWidth: 1, borderTopColor: "#e2e8f0", paddingTop: 8 }}>
              <Text style={styles.rowTitle}>{describeOperation(op)}</Text>
              <Text style={styles.muted}>Saisie le {formatDateTime(op.createdAt)}</Text>
              {(op.errors ?? []).map((e) => (
                <Message key={e}>{e}</Message>
              ))}
              <View style={{ flexDirection: "row", gap: 8 }}>
                <View style={{ flex: 1 }}>
                  <Button title="Relancer" variant="secondary" onPress={() => void retry(op.clientId)} />
                </View>
                <View style={{ flex: 1 }}>
                  <Button
                    title="Abandonner"
                    variant="danger"
                    onPress={() =>
                      Alert.alert("Abandonner cette saisie ?", describeOperation(op), [
                        { text: "Non", style: "cancel" },
                        { text: "Abandonner", style: "destructive", onPress: () => void discard(op.clientId) },
                      ])
                    }
                  />
                </View>
              </View>
            </View>
          ))}
        </Card>
      ) : null}

      <Card title={`En attente d'envoi (${pending.length})`}>
        {pending.length === 0 ? <Text style={styles.muted}>Tout est envoyé.</Text> : null}
        {pending.map((op) => (
          <View key={op.clientId} style={{ flexDirection: "row", justifyContent: "space-between", gap: 8 }}>
            <Text style={[styles.text, { flex: 1 }]}>{describeOperation(op)}</Text>
            <Badge label={formatDateTime(op.createdAt)} />
          </View>
        ))}
      </Card>

      {state.status === "signedIn" ? (
        <Card title="Compte">
          <Text style={styles.text}>{state.me.name}</Text>
          <Text style={styles.muted}>{state.me.email}</Text>
          <Button title="Se déconnecter" variant="secondary" onPress={confirmSignOut} />
        </Card>
      ) : null}
    </Screen>
  );
}
