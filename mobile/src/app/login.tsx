import { Redirect } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button, colors, Field, Message } from "../components/ui";
import { useSession } from "../context/session";
import { ApiError, NetworkError } from "../lib/api";
import { API_URL } from "../lib/config";

/** Connexion avec le compte de la GMAO (mêmes comptes et mêmes droits que sur le web). */
export default function LoginScreen() {
  const { state, signIn } = useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (state.status === "signedIn") return <Redirect href="/" />;

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await signIn(email, password);
    } catch (e) {
      setError(e instanceof ApiError || e instanceof NetworkError ? e.message : "Connexion impossible.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1, justifyContent: "center", padding: 24, gap: 16 }}
      >
        <View style={{ gap: 4 }}>
          <Text style={{ fontSize: 32, fontWeight: "800", color: colors.brand }}>GMAO</Text>
          <Text style={{ fontSize: 16, color: colors.text }}>Maintenance des engins, véhicules et équipements</Text>
        </View>
        {state.status === "signedOut" && state.message ? <Message tone="amber">{state.message}</Message> : null}
        {error ? <Message>{error}</Message> : null}
        <Field
          label="Courriel"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          textContentType="username"
        />
        <Field
          label="Mot de passe"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="password"
          textContentType="password"
          onSubmitEditing={submit}
        />
        <Button title="Se connecter" onPress={submit} busy={busy} disabled={!email || !password} />
        <Text style={{ fontSize: 12, color: colors.muted }}>Serveur : {API_URL}</Text>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
