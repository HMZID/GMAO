import { CameraView, useCameraPermissions, type BarcodeScanningResult } from "expo-camera";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { Text, View } from "react-native";
import { Button, Card, Message, Screen, styles } from "../../components/ui";
import { useSession } from "../../context/session";
import { ApiError, NetworkError } from "../../lib/api";
import { extractQrToken } from "../../lib/qr";
import { cacheStore } from "../../lib/storage";

/**
 * Lecture du QR code d'une étiquette (MOB-02, EQP-09) : le jeton est résolu par l'API dans le périmètre de
 * l'utilisateur. Un code inconnu ou abîmé affiche un message et ne bloque pas l'application.
 */
export default function ScanScreen() {
  const { api } = useSession();
  const [permission, requestPermission] = useCameraPermissions();
  const [active, setActive] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const busy = useRef(false);

  // La caméra ne tourne que sur l'onglet affiché.
  useFocusEffect(
    useCallback(() => {
      setActive(true);
      busy.current = false;
      return () => setActive(false);
    }, []),
  );

  async function onScanned(result: BarcodeScanningResult) {
    if (busy.current) return;
    busy.current = true;
    const token = extractQrToken(result.data);
    try {
      const found = await api.get<{ id: string }>(`/api/v1/equipment/by-qr/${encodeURIComponent(token)}`);
      await cacheStore.set(`qr:${token}`, found);
      setMessage(null);
      router.push({ pathname: "/equipment/[id]", params: { id: found.id } });
    } catch (e) {
      const cached = e instanceof NetworkError ? await cacheStore.get<{ id: string }>(`qr:${token}`) : null;
      if (cached) {
        router.push({ pathname: "/equipment/[id]", params: { id: cached.data.id } });
      } else if (e instanceof ApiError && e.status === 404) {
        setMessage("Code inconnu ou équipement hors de votre périmètre.");
      } else {
        setMessage(
          e instanceof NetworkError
            ? "Hors connexion : cet équipement n'a pas encore été consulté sur l'appareil."
            : "Lecture impossible, réessayer.",
        );
      }
    } finally {
      setTimeout(() => (busy.current = false), 1500);
    }
  }

  if (!permission) return <Screen>{null}</Screen>;
  if (!permission.granted) {
    return (
      <Screen>
        <Card title="Caméra">
          <Text style={styles.text}>La caméra est nécessaire pour lire le QR code des équipements.</Text>
          <Button title="Autoriser la caméra" onPress={requestPermission} />
        </Card>
      </Screen>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#000" }}>
      {active ? (
        <CameraView
          style={{ flex: 1 }}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ["qr", "code128", "datamatrix"] }}
          onBarcodeScanned={onScanned}
        />
      ) : null}
      <View style={{ position: "absolute", left: 16, right: 16, bottom: 24, gap: 8 }}>
        {message ? (
          <Message tone="amber">{message}</Message>
        ) : (
          <Message tone="gray">Viser le QR code de l&apos;étiquette de l&apos;équipement.</Message>
        )}
      </View>
    </View>
  );
}
