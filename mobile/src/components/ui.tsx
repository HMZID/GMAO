import type { ReactNode } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View, type TextInputProps } from "react-native";
import type { Tone } from "../lib/labels";

/**
 * Composants de base (§10.1) : grandes zones tactiles (48 px au moins, usage avec gants),
 * contrastes élevés (usage en plein soleil), saisie minimale.
 */

export const colors = {
  brand: "#0f766e",
  brandDark: "#115e59",
  text: "#0f172a",
  muted: "#475569",
  border: "#cbd5e1",
  bg: "#f1f5f9",
  card: "#ffffff",
  danger: "#b91c1c",
};

const tones: Record<Tone, { bg: string; fg: string }> = {
  gray: { bg: "#e2e8f0", fg: "#1e293b" },
  green: { bg: "#d1fae5", fg: "#065f46" },
  blue: { bg: "#dbeafe", fg: "#1e3a8a" },
  amber: { bg: "#fef3c7", fg: "#78350f" },
  red: { bg: "#fee2e2", fg: "#7f1d1d" },
};

export function Screen({
  children,
  refreshControl,
}: {
  children: ReactNode;
  refreshControl?: React.ComponentProps<typeof ScrollView>["refreshControl"];
}) {
  return (
    <ScrollView
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={styles.screen}
      refreshControl={refreshControl}
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  );
}

export function Card({ title, children, right }: { title?: string; children: ReactNode; right?: ReactNode }) {
  return (
    <View style={styles.card}>
      {title ? (
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>{title}</Text>
          {right}
        </View>
      ) : null}
      {children}
    </View>
  );
}

export function Badge({ label, tone = "gray" }: { label: string; tone?: Tone }) {
  return (
    <View style={[styles.badge, { backgroundColor: tones[tone].bg }]}>
      <Text style={[styles.badgeText, { color: tones[tone].fg }]}>{label}</Text>
    </View>
  );
}

export function Button({
  title,
  onPress,
  variant = "primary",
  disabled,
  busy,
}: {
  title: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "danger";
  disabled?: boolean;
  busy?: boolean;
}) {
  const bg = variant === "primary" ? colors.brand : variant === "danger" ? colors.danger : colors.card;
  const fg = variant === "secondary" ? colors.text : "#fff";
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || busy }}
      onPress={onPress}
      disabled={disabled || busy}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: bg, opacity: disabled ? 0.5 : pressed ? 0.85 : 1 },
        variant === "secondary" && styles.buttonSecondary,
      ]}
    >
      {busy ? <ActivityIndicator color={fg} /> : <Text style={[styles.buttonText, { color: fg }]}>{title}</Text>}
    </Pressable>
  );
}

export function Field({ label, hint, ...props }: TextInputProps & { label: string; hint?: string }) {
  return (
    <View style={{ gap: 4 }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor="#94a3b8"
        style={[styles.input, props.multiline && { minHeight: 90, textAlignVertical: "top" }]}
        {...props}
      />
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

export function Message({ tone = "red", children }: { tone?: Tone; children: ReactNode }) {
  return (
    <View style={[styles.message, { backgroundColor: tones[tone].bg }]}>
      <Text style={{ color: tones[tone].fg, fontSize: 15 }}>{children}</Text>
    </View>
  );
}

export function Row({ title, subtitle, right, onPress }: { title: string; subtitle?: string; right?: ReactNode; onPress?: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: "#e2e8f0" }]}
      accessibilityRole={onPress ? "button" : undefined}
    >
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={styles.rowTitle}>{title}</Text>
        {subtitle ? <Text style={styles.rowSubtitle}>{subtitle}</Text> : null}
      </View>
      {right}
    </Pressable>
  );
}

export function Loading() {
  return <ActivityIndicator size="large" color={colors.brand} style={{ marginTop: 32 }} />;
}

export const styles = StyleSheet.create({
  screen: { padding: 16, gap: 16, paddingBottom: 48 },
  card: { backgroundColor: colors.card, borderRadius: 12, padding: 16, gap: 12, borderWidth: 1, borderColor: colors.border },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 },
  cardTitle: { fontSize: 18, fontWeight: "700", color: colors.text },
  badge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, alignSelf: "flex-start" },
  badgeText: { fontSize: 13, fontWeight: "600" },
  button: { minHeight: 52, borderRadius: 10, alignItems: "center", justifyContent: "center", paddingHorizontal: 16 },
  buttonSecondary: { borderWidth: 1, borderColor: colors.border },
  buttonText: { fontSize: 17, fontWeight: "700" },
  label: { fontSize: 15, fontWeight: "600", color: colors.text },
  hint: { fontSize: 13, color: colors.muted },
  input: {
    minHeight: 52,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    fontSize: 17,
    color: colors.text,
    backgroundColor: "#fff",
  },
  message: { borderRadius: 10, padding: 12 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 56, paddingVertical: 10 },
  rowTitle: { fontSize: 16, fontWeight: "600", color: colors.text },
  rowSubtitle: { fontSize: 14, color: colors.muted },
  text: { fontSize: 16, color: colors.text },
  muted: { fontSize: 14, color: colors.muted },
});
