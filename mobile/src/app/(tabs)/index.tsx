import { router } from "expo-router";
import { RefreshControl, Text } from "react-native";
import { Badge, Card, Loading, Message, Row, Screen, styles } from "../../components/ui";
import { useSession } from "../../context/session";
import { formatDateTime, PRIORITY_TONE, WORK_ORDER_STATUS } from "../../lib/labels";
import { useApiData } from "../../lib/use-api-data";

type WorkOrderItem = {
  id: string;
  number: string;
  title: string;
  status: string;
  priority: string;
  plannedStart: string | null;
  equipmentCode: string;
  equipmentName: string;
  siteName: string;
};

/** OT affectés à l'utilisateur (technicien) ou ouverts dans son périmètre (chef d'atelier), embarqués hors connexion. */
export default function MyWorkOrders() {
  const { can, state } = useSession();
  const technician = state.status === "signedIn" && !!state.me.technicianId;
  const path = `/api/v1/work-orders?status=OPEN&pageSize=100${technician && !can("workorder.manage") ? "&mine=true" : ""}`;
  const { data, loading, error, stale, reload } = useApiData<{ items: WorkOrderItem[] }>(path);

  return (
    <Screen refreshControl={<RefreshControl refreshing={loading} onRefresh={reload} />}>
      {stale ? <Message tone="amber">Hors connexion : liste du {formatDateTime(stale)}.</Message> : null}
      {error ? <Message>{error}</Message> : null}
      {loading && !data ? <Loading /> : null}
      <Card title={technician && !can("workorder.manage") ? "Mes ordres de travail" : "Ordres de travail ouverts"}>
        {data?.items.length === 0 ? <Text style={styles.muted}>Aucun OT ouvert.</Text> : null}
        {data?.items.map((w) => (
          <Row
            key={w.id}
            title={`${w.number} · ${w.equipmentCode}`}
            subtitle={`${w.title}\n${w.plannedStart ? `Prévu le ${formatDateTime(w.plannedStart)}` : "Non planifié"} · ${w.siteName}`}
            right={
              <Badge
                label={WORK_ORDER_STATUS[w.status]?.label ?? w.status}
                tone={w.priority === "P1" ? "red" : (WORK_ORDER_STATUS[w.status]?.tone ?? PRIORITY_TONE[w.priority])}
              />
            }
            onPress={() => router.push({ pathname: "/work-order/[id]", params: { id: w.id } })}
          />
        ))}
      </Card>
    </Screen>
  );
}
