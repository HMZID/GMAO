import { router, Stack, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { RefreshControl, Text } from "react-native";
import { Badge, Button, Card, Field, Loading, Message, Row, Screen, styles } from "../../components/ui";
import { useSession } from "../../context/session";
import { useSync } from "../../context/sync";
import { DUE_STATUS, EQUIPMENT_STATUS, formatDate, formatDateTime, formatNumber, WORK_ORDER_STATUS } from "../../lib/labels";
import { useApiData } from "../../lib/use-api-data";

type EquipmentDetail = {
  id: string;
  code: string;
  name: string;
  status: string;
  criticality: string;
  manufacturer: string;
  serialNumber: string | null;
  registration: string | null;
  site: { name: string };
  company: { name: string };
  category: { name: string };
  meters: { id: string; label: string; unit: string; lastValue: number | null; lastReadAt: string | null; isPrimary: boolean }[];
  dueItems: { id: string; status: string; dueDate: string | null; dueMeterValue: number | null; operationName: string }[];
  recentWorkOrders: { id: string; number: string; title: string; status: string }[];
};

/** Fiche équipement (§10.2) : état, compteurs, prochaines échéances, dernières interventions, signalement. */
export default function EquipmentScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { can } = useSession();
  const { enqueue, operations } = useSync();
  const { data: e, loading, error, stale, reload } = useApiData<EquipmentDetail>(`/api/v1/equipment/${id}`);
  const [reading, setReading] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const primary = e?.meters.find((m) => m.isPrimary) ?? e?.meters[0];
  const pendingReadings = operations.filter((o) => o.kind === "reading" && o.meterId === primary?.id);

  async function saveReading() {
    if (!primary) return;
    const value = Number(reading.replace(",", "."));
    if (!Number.isFinite(value) || value < 0) return setNotice("Valeur invalide.");
    // MOB-04 : un relevé inférieur au précédent est signalé avant envoi.
    if (primary.lastValue != null && value < primary.lastValue) {
      return setNotice(`Relevé inférieur au dernier relevé (${formatNumber(primary.lastValue)} ${primary.unit}) : vérifier la valeur.`);
    }
    await enqueue({ kind: "reading", meterId: primary.id, value });
    setReading("");
    setNotice("Relevé enregistré : il sera contrôlé par le serveur à l'envoi.");
  }

  if (loading && !e) return <Loading />;
  if (!e) return <Screen>{error ? <Message>{error}</Message> : null}</Screen>;

  return (
    <Screen refreshControl={<RefreshControl refreshing={loading} onRefresh={reload} />}>
      <Stack.Screen options={{ title: e.code }} />
      {stale ? <Message tone="amber">Hors connexion : fiche du {formatDateTime(stale)}.</Message> : null}
      <Card
        title={`${e.code} · ${e.name}`}
        right={<Badge label={EQUIPMENT_STATUS[e.status]?.label ?? e.status} tone={EQUIPMENT_STATUS[e.status]?.tone} />}
      >
        <Text style={styles.text}>
          {e.category.name} · {e.manufacturer}
          {e.serialNumber ? ` · n° ${e.serialNumber}` : ""}
        </Text>
        <Text style={styles.muted}>
          {e.site.name} · {e.company.name} · criticité {e.criticality}
          {e.registration ? ` · ${e.registration}` : ""}
        </Text>
        {can("request.create") && e.status !== "RETIRED" ? (
          <Button
            title="Signaler une panne"
            variant="danger"
            onPress={() => router.push({ pathname: "/request/new", params: { equipmentId: e.id, code: e.code } })}
          />
        ) : null}
      </Card>

      {primary ? (
        <Card title="Compteur">
          <Text style={styles.text}>
            {primary.label} : {formatNumber(primary.lastValue)} {primary.unit}
          </Text>
          <Text style={styles.muted}>Dernier relevé le {formatDateTime(primary.lastReadAt)}</Text>
          {pendingReadings.length > 0 ? <Message tone="blue">{pendingReadings.length} relevé(s) en attente d&apos;envoi.</Message> : null}
          {can("meter.write") && e.status !== "RETIRED" ? (
            <>
              <Field label={`Nouveau relevé (${primary.unit})`} value={reading} onChangeText={setReading} keyboardType="decimal-pad" />
              {notice ? <Message tone="amber">{notice}</Message> : null}
              <Button title="Enregistrer le relevé" onPress={() => void saveReading()} disabled={!reading} />
            </>
          ) : null}
        </Card>
      ) : null}

      <Card title="Prochaines échéances">
        {e.dueItems.length === 0 ? <Text style={styles.muted}>Aucune échéance ouverte.</Text> : null}
        {e.dueItems.map((d) => (
          <Row
            key={d.id}
            title={d.operationName}
            subtitle={[d.dueDate ? `le ${formatDate(d.dueDate)}` : null, d.dueMeterValue != null ? `à ${formatNumber(d.dueMeterValue)}` : null]
              .filter(Boolean)
              .join(" · ")}
            right={<Badge label={DUE_STATUS[d.status]?.label ?? d.status} tone={DUE_STATUS[d.status]?.tone} />}
          />
        ))}
      </Card>

      {can("workorder.read") ? (
        <Card title="Dernières interventions">
          {e.recentWorkOrders.length === 0 ? <Text style={styles.muted}>Aucune intervention.</Text> : null}
          {e.recentWorkOrders.slice(0, 10).map((w) => (
            <Row
              key={w.id}
              title={w.number}
              subtitle={w.title}
              right={<Badge label={WORK_ORDER_STATUS[w.status]?.label ?? w.status} tone={WORK_ORDER_STATUS[w.status]?.tone} />}
              onPress={() => router.push({ pathname: "/work-order/[id]", params: { id: w.id } })}
            />
          ))}
        </Card>
      ) : null}
    </Screen>
  );
}
