import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Switch, Text, View } from "react-native";
import { Button, Card, colors, Field, Message, Screen, styles } from "../../components/ui";
import { useSync } from "../../context/sync";
import { useT } from "../../i18n";

/**
 * Signalement d'une panne (MOB-03, COR-01) en un écran : symptôme, machine arrêtée, risque sécurité.
 * Possible hors connexion : la DI part à la synchronisation, sans doublon (clientId) ; la priorité est
 * proposée par le serveur puis confirmée par le chef d'atelier.
 */
export default function NewRequest() {
  const { equipmentId, code } = useLocalSearchParams<{ equipmentId: string; code?: string }>();
  const { enqueue, online } = useSync();
  const t = useT();
  const [symptom, setSymptom] = useState("");
  const [description, setDescription] = useState("");
  const [isStopped, setStopped] = useState(false);
  const [isSafetyRisk, setSafety] = useState(false);

  async function submit() {
    await enqueue({ kind: "request", equipmentId, symptom: symptom.trim(), description: description.trim() || undefined, isStopped, isSafetyRisk });
    router.back();
  }

  return (
    <Screen>
      <Card title={code ? t("Panne sur {code}", { code }) : t("Panne sur l'équipement")}>
        {!online ? <Message tone="amber">{t("Hors connexion : la demande sera envoyée au retour du réseau.")}</Message> : null}
        <Field
          label="Symptôme"
          required
          hint="3 caractères au minimum"
          value={symptom}
          onChangeText={setSymptom}
          placeholder="Ex. fuite hydraulique sur le bras"
          maxLength={200}
        />
        <Field label="Précisions" value={description} onChangeText={setDescription} multiline maxLength={2000} />
        <Toggle label="La machine est arrêtée" value={isStopped} onChange={setStopped} />
        <Toggle label="Risque pour la sécurité" value={isSafetyRisk} onChange={setSafety} />
        <Button title="Envoyer le signalement" variant="danger" onPress={() => void submit()} disabled={symptom.trim().length < 3} />
      </Card>
    </Screen>
  );
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  const t = useT();
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", minHeight: 52 }}>
      <Text style={styles.text}>{t(label)}</Text>
      <Switch accessibilityLabel={t(label)} value={value} onValueChange={onChange} trackColor={{ true: colors.brand }} />
    </View>
  );
}
