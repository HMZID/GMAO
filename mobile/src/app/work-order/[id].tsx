import { router, Stack, useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import { Alert, Pressable, RefreshControl, Text, View } from "react-native";
import { Badge, Button, Card, colors, Field, Loading, Message, Row, Screen, styles } from "../../components/ui";
import { useSession } from "../../context/session";
import { useSync } from "../../context/sync";
import { formatDateTime, formatNumber, PRIORITY_TONE, WORK_ORDER_STATUS } from "../../lib/labels";
import { takeCompressedPhoto } from "../../lib/photo";
import { describeOperation } from "../../lib/sync";
import { useApiData } from "../../lib/use-api-data";

type Task = {
  id: string;
  label: string;
  kind: "CHECK" | "MEASURE" | "TEXT";
  required: boolean;
  unit: string | null;
  minValue: number | null;
  maxValue: number | null;
  result: string | null;
  measuredValue: number | null;
};
type WorkOrder = {
  id: string;
  number: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  plannedStart: string | null;
  equipment: { id: string; code: string; name: string };
  site: { name: string };
  tasks: Task[];
  timeEntries: { id: string; minutes: number | null; startedAt: string; technician: { firstName: string; lastName: string } }[];
  partLines: { id: string; type: string; quantity: number; sku: string; partName: string; unit: string; warehouseName: string }[];
  meters: { id: string; label: string; unit: string; lastValue: number | null; isPrimary: boolean }[];
  workSummary: string | null;
  symptomCode: string | null;
  causeCode: string | null;
  remedyCode: string | null;
  transitions: { to: string; allowed: boolean; errors: string[] }[];
  canExecute: boolean;
};
type Part = { id: string; sku: string; name: string; unit: string };
type Warehouse = { id: string; name: string; siteName: string; isMobile: boolean };

/**
 * Exécution d'un OT par le technicien (MOB-05, MOB-06, COR-04, COR-09, COR-10) : démarrage, checklist,
 * diagnostic et compte rendu, temps, pièces, relevé, photos, fin de travaux. Tout est saisissable hors
 * connexion et part à la synchronisation ; les contrôles restent ceux du serveur (DON-11).
 */
export default function WorkOrderScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { can } = useSession();
  const { enqueue, operations } = useSync();
  const { data: wo, loading, error, stale, reload } = useApiData<WorkOrder>(`/api/v1/work-orders/${id}`);
  const pending = useMemo(
    () => operations.filter((o) => ("workOrderId" in o && o.workOrderId === id) || (o.kind === "photo" && o.entityId === id)),
    [operations, id],
  );

  if (loading && !wo) return <Loading />;
  if (!wo) return <Screen>{error ? <Message>{error}</Message> : null}</Screen>;

  const executable = wo.canExecute && ["PLANNED", "IN_PROGRESS", "ON_HOLD", "WORK_DONE"].includes(wo.status);
  const inProgress = wo.status === "IN_PROGRESS";
  const transition = (to: string) => wo.transitions.find((t) => t.to === to);

  return (
    <Screen refreshControl={<RefreshControl refreshing={loading} onRefresh={reload} />}>
      <Stack.Screen options={{ title: wo.number }} />
      {stale ? <Message tone="amber">Hors connexion : OT du {formatDateTime(stale)}. Les saisies partiront au retour du réseau.</Message> : null}

      <Card title={wo.title} right={<Badge label={WORK_ORDER_STATUS[wo.status]?.label ?? wo.status} tone={WORK_ORDER_STATUS[wo.status]?.tone} />}>
        <Row
          title={`${wo.equipment.code} · ${wo.equipment.name}`}
          subtitle={wo.site.name}
          onPress={() => router.push({ pathname: "/equipment/[id]", params: { id: wo.equipment.id } })}
        />
        <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
          <Badge label={wo.priority} tone={PRIORITY_TONE[wo.priority]} />
          {wo.plannedStart ? <Badge label={`Prévu le ${formatDateTime(wo.plannedStart)}`} /> : null}
        </View>
        {wo.description ? <Text style={styles.text}>{wo.description}</Text> : null}
        {pending.length > 0 ? (
          <Message tone="blue">
            {pending.length} saisie(s) en attente d&apos;envoi : {pending.map((p) => describeOperation(p)).join(", ")}.
          </Message>
        ) : null}
        {wo.canExecute && transition("IN_PROGRESS") ? (
          <Button
            title={wo.status === "WORK_DONE" ? "Reprendre les travaux" : "Démarrer l'intervention"}
            onPress={() =>
              void enqueue({
                kind: "transition",
                workOrderId: wo.id,
                to: "IN_PROGRESS",
                reason: wo.status === "WORK_DONE" ? "Reprise depuis le mobile" : undefined,
              })
            }
          />
        ) : null}
      </Card>

      {wo.tasks.length > 0 ? <Checklist wo={wo} editable={executable} /> : null}
      {executable ? <ReportCard wo={wo} /> : null}
      {executable ? <TimeCard wo={wo} /> : null}
      {executable && can("stock.move") ? <PartsCard wo={wo} /> : null}
      {executable && can("meter.write") ? <ReadingCard wo={wo} /> : null}
      {executable ? <PhotosCard wo={wo} /> : null}

      {wo.canExecute && inProgress ? (
        <Card title="Fin des travaux">
          {transition("WORK_DONE") && !transition("WORK_DONE")!.allowed && pending.length === 0
            ? transition("WORK_DONE")!.errors.map((e) => (
                <Message key={e} tone="amber">
                  {e}
                </Message>
              ))
            : null}
          <Text style={styles.muted}>
            Le serveur vérifie toutes les conditions (checklist, temps, relevé) à l&apos;envoi ; un refus apparaît dans « Synchro ».
          </Text>
          <Button
            title="Travaux terminés"
            onPress={() =>
              Alert.alert("Travaux terminés ?", "L'OT passera à « Travaux terminés » après envoi des saisies.", [
                { text: "Annuler", style: "cancel" },
                { text: "Confirmer", onPress: () => void enqueue({ kind: "transition", workOrderId: wo.id, to: "WORK_DONE" }) },
              ])
            }
          />
        </Card>
      ) : null}
    </Screen>
  );
}

/* ------------------------------------------------------------------ */

function Checklist({ wo, editable }: { wo: WorkOrder; editable: boolean }) {
  const { enqueue, operations } = useSync();
  const [values, setValues] = useState<Record<string, string>>({});
  const local = (taskId: string) => operations.filter((o) => o.kind === "task" && o.taskId === taskId).at(-1);

  return (
    <Card title="Checklist">
      {wo.tasks.map((t) => {
        const queued = local(t.id);
        const result = queued && queued.kind === "task" ? queued.result : t.result;
        return (
          <View key={t.id} style={{ gap: 8, borderTopWidth: 1, borderTopColor: "#e2e8f0", paddingTop: 8 }}>
            <Text style={styles.rowTitle}>
              {t.label}
              {t.required ? " *" : ""}
            </Text>
            {t.kind === "MEASURE" ? (
              <Text style={styles.muted}>
                Mesure en {t.unit ?? "—"}
                {t.minValue != null || t.maxValue != null ? ` (attendu : ${formatNumber(t.minValue)} à ${formatNumber(t.maxValue)})` : ""}
                {t.measuredValue != null ? ` · relevé : ${formatNumber(t.measuredValue)}` : ""}
              </Text>
            ) : null}
            {editable ? (
              t.kind === "MEASURE" ? (
                <View style={{ flexDirection: "row", gap: 8, alignItems: "flex-end" }}>
                  <View style={{ flex: 1 }}>
                    <Field
                      label="Valeur mesurée"
                      keyboardType="decimal-pad"
                      value={values[t.id] ?? ""}
                      onChangeText={(v) => setValues({ ...values, [t.id]: v })}
                    />
                  </View>
                  <Button
                    title="OK"
                    disabled={!values[t.id]}
                    onPress={() =>
                      void enqueue({ kind: "task", workOrderId: wo.id, taskId: t.id, measuredValue: Number(values[t.id].replace(",", ".")) })
                    }
                  />
                </View>
              ) : (
                <View style={{ flexDirection: "row", gap: 8 }}>
                  {(["OK", "NOK", "NA"] as const).map((r) => (
                    <Pressable
                      key={r}
                      accessibilityRole="button"
                      accessibilityState={{ selected: result === r }}
                      onPress={() => void enqueue({ kind: "task", workOrderId: wo.id, taskId: t.id, result: r })}
                      style={{
                        flex: 1,
                        minHeight: 52,
                        borderRadius: 10,
                        alignItems: "center",
                        justifyContent: "center",
                        borderWidth: 2,
                        borderColor: result === r ? (r === "NOK" ? colors.danger : colors.brand) : "#cbd5e1",
                        backgroundColor: result === r ? (r === "NOK" ? "#fee2e2" : "#ccfbf1") : "#fff",
                      }}
                    >
                      <Text style={{ fontSize: 17, fontWeight: "700", color: colors.text }}>{r === "NA" ? "N/A" : r}</Text>
                    </Pressable>
                  ))}
                </View>
              )
            ) : (
              <Text style={styles.muted}>{result ?? "Non renseigné"}</Text>
            )}
          </View>
        );
      })}
    </Card>
  );
}

function ReportCard({ wo }: { wo: WorkOrder }) {
  const { enqueue } = useSync();
  const [symptomCode, setSymptom] = useState(wo.symptomCode ?? "");
  const [causeCode, setCause] = useState(wo.causeCode ?? "");
  const [remedyCode, setRemedy] = useState(wo.remedyCode ?? "");
  const [workSummary, setSummary] = useState(wo.workSummary ?? "");
  const [saved, setSaved] = useState(false);
  return (
    <Card title="Diagnostic et compte rendu">
      <Field label="Symptôme constaté" value={symptomCode} onChangeText={setSymptom} maxLength={40} />
      <Field label="Cause" value={causeCode} onChangeText={setCause} maxLength={40} />
      <Field label="Remède" value={remedyCode} onChangeText={setRemedy} maxLength={40} />
      <Field label="Travaux réalisés" value={workSummary} onChangeText={setSummary} multiline maxLength={4000} />
      {saved ? <Message tone="green">Compte rendu enregistré.</Message> : null}
      <Button
        title="Enregistrer le compte rendu"
        onPress={() => {
          void enqueue({
            kind: "report",
            workOrderId: wo.id,
            symptomCode: symptomCode || undefined,
            causeCode: causeCode || undefined,
            remedyCode: remedyCode || undefined,
            workSummary: workSummary || undefined,
          });
          setSaved(true);
        }}
      />
    </Card>
  );
}

function TimeCard({ wo }: { wo: WorkOrder }) {
  const { enqueue } = useSync();
  const [minutes, setMinutes] = useState("");
  const [comment, setComment] = useState("");
  const total = wo.timeEntries.reduce((s, e) => s + (e.minutes ?? 0), 0);
  return (
    <Card title="Temps passé">
      <Text style={styles.muted}>
        Déjà enregistré : {Math.floor(total / 60)} h {String(total % 60).padStart(2, "0")}
      </Text>
      <View style={{ flexDirection: "row", gap: 8 }}>
        {[15, 30, 60, 120].map((m) => (
          <View key={m} style={{ flex: 1 }}>
            <Button title={m < 60 ? `${m} min` : `${m / 60} h`} variant="secondary" onPress={() => setMinutes(String(m))} />
          </View>
        ))}
      </View>
      <Field label="Durée (minutes)" keyboardType="number-pad" value={minutes} onChangeText={setMinutes} />
      <Field label="Commentaire" value={comment} onChangeText={setComment} maxLength={500} />
      <Button
        title="Ajouter le temps"
        disabled={!(Number(minutes) > 0)}
        onPress={() => {
          void enqueue({ kind: "time", workOrderId: wo.id, minutes: Math.round(Number(minutes)), comment: comment || undefined });
          setMinutes("");
          setComment("");
        }}
      />
    </Card>
  );
}

function PartsCard({ wo }: { wo: WorkOrder }) {
  const { enqueue } = useSync();
  const [q, setQ] = useState("");
  const [query, setQuery] = useState("");
  const [part, setPart] = useState<Part | null>(null);
  const [warehouseId, setWarehouse] = useState<string | null>(null);
  const [quantity, setQuantity] = useState("1");
  const parts = useApiData<{ items: Part[] }>(query ? `/api/v1/parts?q=${encodeURIComponent(query)}&pageSize=20` : null);
  const warehouses = useApiData<Warehouse[]>("/api/v1/warehouses");

  return (
    <Card title="Pièces consommées">
      {wo.partLines.map((l) => (
        <Text key={l.id} style={styles.text}>
          {l.type === "RETURN" ? "Retour" : "Sortie"} · {formatNumber(l.quantity)} {l.unit} · {l.sku} {l.partName} ({l.warehouseName})
        </Text>
      ))}
      <Field
        label="Article"
        value={q}
        onChangeText={setQ}
        onSubmitEditing={() => setQuery(q.trim())}
        returnKeyType="search"
        placeholder="Référence ou désignation"
      />
      {parts.data?.items.map((p) => (
        <Row
          key={p.id}
          title={`${p.sku} · ${p.name}`}
          right={part?.id === p.id ? <Badge label="Choisi" tone="green" /> : undefined}
          onPress={() => setPart(p)}
        />
      ))}
      <Text style={styles.label}>Magasin</Text>
      {warehouses.data?.map((w) => (
        <Row
          key={w.id}
          title={w.name}
          subtitle={w.siteName}
          right={warehouseId === w.id ? <Badge label="Choisi" tone="green" /> : undefined}
          onPress={() => setWarehouse(w.id)}
        />
      ))}
      <Field label={`Quantité${part ? ` (${part.unit})` : ""}`} keyboardType="decimal-pad" value={quantity} onChangeText={setQuantity} />
      <Button
        title="Consommer la pièce"
        disabled={!part || !warehouseId || !(Number(quantity.replace(",", ".")) > 0)}
        onPress={() => {
          void enqueue({
            kind: "part",
            workOrderId: wo.id,
            partId: part!.id,
            warehouseId: warehouseId!,
            quantity: Number(quantity.replace(",", ".")),
            label: `${part!.sku} ${part!.name}`,
          });
          setPart(null);
          setQuantity("1");
        }}
      />
      <Text style={styles.muted}>
        Stock insuffisant au serveur : la consommation est refusée et apparaît « à revoir » dans Synchro (le stock ne devient jamais négatif).
      </Text>
    </Card>
  );
}

function ReadingCard({ wo }: { wo: WorkOrder }) {
  const { enqueue } = useSync();
  const meter = wo.meters.find((m) => m.isPrimary) ?? wo.meters[0];
  const [value, setValue] = useState("");
  const [warning, setWarning] = useState<string | null>(null);
  if (!meter) return null;
  return (
    <Card title="Relevé du compteur">
      <Text style={styles.muted}>
        Dernier relevé : {formatNumber(meter.lastValue)} {meter.unit}
      </Text>
      <Field label={`${meter.label} (${meter.unit})`} keyboardType="decimal-pad" value={value} onChangeText={setValue} />
      {warning ? <Message tone="amber">{warning}</Message> : null}
      <Button
        title="Enregistrer le relevé"
        disabled={!value}
        onPress={() => {
          const v = Number(value.replace(",", "."));
          if (meter.lastValue != null && v < meter.lastValue)
            return setWarning(`Valeur inférieure au dernier relevé (${formatNumber(meter.lastValue)}) : vérifier.`);
          void enqueue({ kind: "reading", meterId: meter.id, value: v, workOrderId: wo.id });
          setValue("");
          setWarning(null);
        }}
      />
    </Card>
  );
}

function PhotosCard({ wo }: { wo: WorkOrder }) {
  const { enqueue } = useSync();
  const [error, setError] = useState<string | null>(null);
  const documents = useApiData<{ items: { id: string; title: string; kind: string; createdAt: string }[] }>(
    `/api/v1/documents?entityType=WORK_ORDER&entityId=${wo.id}`,
  );
  const photos = documents.data?.items.filter((d) => d.kind === "PHOTO") ?? [];
  return (
    <Card title="Photos">
      <Text style={styles.muted}>{photos.length} photo(s) déjà jointe(s). Les photos partent après les autres saisies.</Text>
      {error ? <Message>{error}</Message> : null}
      <Button
        title="Prendre une photo"
        variant="secondary"
        onPress={async () => {
          try {
            setError(null);
            const photo = await takeCompressedPhoto();
            if (photo)
              await enqueue({
                kind: "photo",
                entityType: "WORK_ORDER",
                entityId: wo.id,
                uri: photo.uri,
                fileName: photo.fileName,
                title: `Photo ${wo.number}`,
              });
          } catch (e) {
            setError(e instanceof Error ? e.message : "Photo impossible.");
          }
        }}
      />
    </Card>
  );
}
