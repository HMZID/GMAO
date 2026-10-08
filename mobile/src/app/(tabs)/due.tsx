import { router } from "expo-router";
import { RefreshControl, Text } from "react-native";
import { Badge, Card, Loading, Message, Row, Screen, styles } from "../../components/ui";
import { DUE_STATUS, formatDate, formatDateTime, formatNumber } from "../../lib/labels";
import { useApiData } from "../../lib/use-api-data";

type DueItem = {
  id: string;
  status: string;
  dueDate: string | null;
  dueMeterValue: number | null;
  meterUnit: string | null;
  equipmentId: string;
  equipmentCode: string;
  operationName: string;
  workOrderNumber: string | null;
};

/** Tâches de maintenance préventive à venir, en pré-alerte, échues ou en retard (PRV). */
export default function DueItems() {
  const { data, loading, error, stale, reload } = useApiData<DueItem[]>("/api/v1/due-items?status=OPEN");
  const items = (data ?? []).filter((d) => d.status !== "UPCOMING");

  return (
    <Screen refreshControl={<RefreshControl refreshing={loading} onRefresh={reload} />}>
      {stale ? <Message tone="amber">Hors connexion : échéances du {formatDateTime(stale)}.</Message> : null}
      {error ? <Message>{error}</Message> : null}
      {loading && !data ? <Loading /> : null}
      <Card title="Échéances à traiter">
        {data && items.length === 0 ? <Text style={styles.muted}>Aucune échéance en pré-alerte ou en retard.</Text> : null}
        {items.map((d) => (
          <Row
            key={d.id}
            title={`${d.equipmentCode} · ${d.operationName}`}
            subtitle={[
              d.dueDate ? `le ${formatDate(d.dueDate)}` : null,
              d.dueMeterValue != null ? `à ${formatNumber(d.dueMeterValue)} ${d.meterUnit ?? ""}` : null,
              d.workOrderNumber ? `OT ${d.workOrderNumber}` : null,
            ]
              .filter(Boolean)
              .join(" · ")}
            right={<Badge label={DUE_STATUS[d.status]?.label ?? d.status} tone={DUE_STATUS[d.status]?.tone} />}
            onPress={() => router.push({ pathname: "/equipment/[id]", params: { id: d.equipmentId } })}
          />
        ))}
      </Card>
    </Screen>
  );
}
