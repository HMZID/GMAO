import { router, Stack, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { RefreshControl, Text } from "react-native";
import { Badge, Button, Card, Field, Loading, Message, Row, Screen, styles } from "../../components/ui";
import { useSession } from "../../context/session";
import { useSync } from "../../context/sync";
import { useT } from "../../i18n";
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

type FuelProduct = "DIESEL" | "GASOLINE" | "ADBLUE";

/** Produits proposés à la pompe ; un appui passe au suivant. */
const FUEL_PRODUCT: Record<FuelProduct, string> = { DIESEL: "Produit : gasoil", GASOLINE: "Produit : essence", ADBLUE: "Produit : AdBlue" };
const nextProduct = (p: FuelProduct): FuelProduct => (p === "DIESEL" ? "GASOLINE" : p === "GASOLINE" ? "ADBLUE" : "DIESEL");

/** Fiche équipement (§10.2) : état, compteurs, prochaines échéances, dernières interventions, signalement. */
export default function EquipmentScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { can } = useSession();
  const { enqueue, operations } = useSync();
  const t = useT();
  const { data: e, loading, error, stale, reload } = useApiData<EquipmentDetail>(`/api/v1/equipment/${id}`);
  const [reading, setReading] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [litres, setLitres] = useState("");
  const [fuelMeter, setFuelMeter] = useState("");
  const [fluid, setFluid] = useState<FuelProduct>("DIESEL");
  const [fullTank, setFullTank] = useState(true);
  const [fuelNotice, setFuelNotice] = useState<string | null>(null);
  const primary = e?.meters.find((m) => m.isPrimary) ?? e?.meters[0];
  const pendingReadings = operations.filter((o) => o.kind === "reading" && o.meterId === primary?.id);
  const pendingFuel = operations.filter((o) => o.kind === "fuel" && o.equipmentId === id);

  async function saveReading() {
    if (!primary) return;
    const value = Number(reading.replace(",", "."));
    if (!Number.isFinite(value) || value < 0) return setNotice(t("Valeur invalide."));
    // MOB-04 : un relevé inférieur au précédent est signalé avant envoi.
    if (primary.lastValue != null && value < primary.lastValue) {
      return setNotice(
        t("Relevé inférieur au dernier relevé ({value}) : vérifier la valeur.", { value: `${formatNumber(primary.lastValue)} ${primary.unit}` }),
      );
    }
    await enqueue({ kind: "reading", meterId: primary.id, value });
    setReading("");
    setNotice(t("Relevé enregistré : il sera contrôlé par le serveur à l'envoi."));
  }

  /** Plein saisi au pied de la pompe, même sans réseau : la consommation et les anomalies sont calculées par le serveur. */
  async function saveFuel() {
    if (!e) return;
    const quantity = Number(litres.replace(",", "."));
    if (!Number.isFinite(quantity) || quantity <= 0) return setFuelNotice(t("Quantité invalide."));
    const meterValue = fuelMeter ? Number(fuelMeter.replace(",", ".")) : undefined;
    if (meterValue !== undefined && (!Number.isFinite(meterValue) || meterValue < 0)) return setFuelNotice(t("Valeur invalide."));
    await enqueue({ kind: "fuel", equipmentId: e.id, fluid, quantity, meterValue, fullTank, label: e.code });
    setLitres("");
    setFuelMeter("");
    setFuelNotice(t("Plein enregistré : il sera envoyé et contrôlé par le serveur."));
  }

  if (loading && !e) return <Loading />;
  if (!e) return <Screen>{error ? <Message>{error}</Message> : null}</Screen>;

  return (
    <Screen refreshControl={<RefreshControl refreshing={loading} onRefresh={reload} />}>
      <Stack.Screen options={{ title: e.code }} />
      {stale ? <Message tone="amber">{t("Hors connexion : fiche du {date}.", { date: formatDateTime(stale) })}</Message> : null}
      <Card
        title={`${e.code} · ${e.name}`}
        right={<Badge label={EQUIPMENT_STATUS[e.status]?.label ?? e.status} tone={EQUIPMENT_STATUS[e.status]?.tone} />}
      >
        <Text style={styles.text}>
          {e.category.name} · {e.manufacturer}
          {e.serialNumber ? ` · ${t("n° {number}", { number: e.serialNumber })}` : ""}
        </Text>
        <Text style={styles.muted}>
          {e.site.name} · {e.company.name} · {t("criticité {level}", { level: e.criticality })}
          {e.registration ? ` · ${e.registration}` : ""}
        </Text>
        {can("request.create") && e.status !== "RETIRED" ? (
          <Button
            title="Créer une demande d'intervention"
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
          <Text style={styles.muted}>{t("Dernier relevé le {date}", { date: formatDateTime(primary.lastReadAt) })}</Text>
          {pendingReadings.length > 0 ? (
            <Message tone="blue">{t("{count} relevé(s) en attente d'envoi.", { count: pendingReadings.length })}</Message>
          ) : null}
          {can("meter.write") && e.status !== "RETIRED" ? (
            <>
              <Field
                label={t("Nouveau relevé ({unit})", { unit: primary.unit })}
                value={reading}
                onChangeText={setReading}
                keyboardType="decimal-pad"
              />
              {notice ? <Message tone="amber">{notice}</Message> : null}
              <Button title="Enregistrer le relevé" onPress={() => void saveReading()} disabled={!reading} />
            </>
          ) : null}
        </Card>
      ) : null}

      {can("fuel.write") && e.status !== "RETIRED" ? (
        <Card title="Carburant">
          {pendingFuel.length > 0 ? <Message tone="blue">{t("{count} plein(s) en attente d'envoi.", { count: pendingFuel.length })}</Message> : null}
          <Button title={FUEL_PRODUCT[fluid]} variant="secondary" onPress={() => setFluid(nextProduct(fluid))} />
          <Field label="Quantité (L)" value={litres} onChangeText={setLitres} keyboardType="decimal-pad" />
          {primary ? (
            <Field
              label={t("Compteur au plein ({unit})", { unit: primary.unit })}
              value={fuelMeter}
              onChangeText={setFuelMeter}
              keyboardType="decimal-pad"
            />
          ) : null}
          <Button title={fullTank ? "Plein complet" : "Appoint (réservoir non rempli)"} variant="secondary" onPress={() => setFullTank((v) => !v)} />
          {fuelNotice ? <Message tone="amber">{fuelNotice}</Message> : null}
          <Button title="Enregistrer le plein" onPress={() => void saveFuel()} disabled={!litres} />
        </Card>
      ) : null}

      <Card title="Prochaines échéances">
        {e.dueItems.length === 0 ? <Text style={styles.muted}>{t("Aucune échéance ouverte.")}</Text> : null}
        {e.dueItems.map((d) => (
          <Row
            key={d.id}
            title={d.operationName}
            subtitle={[
              d.dueDate ? t("le {date}", { date: formatDate(d.dueDate) }) : null,
              d.dueMeterValue != null ? t("à {value}", { value: formatNumber(d.dueMeterValue) }) : null,
            ]
              .filter(Boolean)
              .join(" · ")}
            right={<Badge label={DUE_STATUS[d.status]?.label ?? d.status} tone={DUE_STATUS[d.status]?.tone} />}
          />
        ))}
      </Card>

      {can("workorder.read") ? (
        <Card title="Dernières interventions">
          {e.recentWorkOrders.length === 0 ? <Text style={styles.muted}>{t("Aucune intervention.")}</Text> : null}
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
