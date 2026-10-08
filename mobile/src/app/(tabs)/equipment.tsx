import { router } from "expo-router";
import { useState } from "react";
import { RefreshControl, Text } from "react-native";
import { Badge, Card, Field, Loading, Message, Row, Screen, styles } from "../../components/ui";
import { EQUIPMENT_STATUS, formatDateTime } from "../../lib/labels";
import { useApiData } from "../../lib/use-api-data";

type EquipmentItem = { id: string; code: string; name: string; status: string; siteName: string; categoryName: string };

/** Équipements du périmètre (CDC §10.3), recherche par code, désignation, immatriculation. */
export default function EquipmentList() {
  const [q, setQ] = useState("");
  const [query, setQuery] = useState("");
  const { data, loading, error, stale, reload } = useApiData<{ items: EquipmentItem[] }>(
    `/api/v1/equipment?pageSize=200${query ? `&q=${encodeURIComponent(query)}` : ""}`,
  );

  return (
    <Screen refreshControl={<RefreshControl refreshing={loading} onRefresh={reload} />}>
      <Field
        label="Rechercher"
        value={q}
        onChangeText={setQ}
        onSubmitEditing={() => setQuery(q.trim())}
        returnKeyType="search"
        placeholder="Code, désignation, immatriculation"
      />
      {stale ? <Message tone="amber">Hors connexion : liste du {formatDateTime(stale)}.</Message> : null}
      {error ? <Message>{error}</Message> : null}
      {loading && !data ? <Loading /> : null}
      <Card title="Équipements">
        {data?.items.length === 0 ? <Text style={styles.muted}>Aucun équipement.</Text> : null}
        {data?.items.map((e) => (
          <Row
            key={e.id}
            title={`${e.code} · ${e.name}`}
            subtitle={`${e.categoryName} · ${e.siteName}`}
            right={<Badge label={EQUIPMENT_STATUS[e.status]?.label ?? e.status} tone={EQUIPMENT_STATUS[e.status]?.tone} />}
            onPress={() => router.push({ pathname: "/equipment/[id]", params: { id: e.id } })}
          />
        ))}
      </Card>
    </Screen>
  );
}
