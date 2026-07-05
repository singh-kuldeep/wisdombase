import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import {
  getProviderKeys,
  setProviderKeys,
  PROVIDERS,
  type ProviderId,
  type ProviderKey,
} from "../../lib/secureStore";
import { getMemory, refreshMemory, deleteAccount } from "../../lib/api";
import { useAuth } from "../../stores/authStore";
import { colors, fonts } from "../../theme";

export default function Settings() {
  const router = useRouter();
  const { session, signOut } = useAuth();
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [order, setOrder] = useState<ProviderId[]>([]);
  const [memory, setMemory] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    getProviderKeys().then((keys) => {
      const d: Record<string, string> = {};
      keys.forEach((k) => (d[k.provider] = k.apiKey));
      setDrafts(d);
      setOrder(keys.map((k) => k.provider));
    });
    getMemory()
      .then((m) => setMemory(m.profile))
      .catch(() => {});
  }, []);

  const refreshMemoryProfile = async () => {
    setRefreshing(true);
    try {
      const providers = await getProviderKeys();
      const api_key = providers.find((p) => p.provider === "anthropic")?.apiKey ?? null;
      if (!providers.length) {
        Alert.alert("Add a key first", "Save an AI provider key above to build your memory profile.");
        return;
      }
      const res = await refreshMemory({ providers, api_key });
      if (res.updated) {
        setMemory(res.profile);
        Alert.alert("Memory updated", "Your long-term memory profile has been refreshed.");
      } else {
        Alert.alert("Nothing to summarize yet", res.detail ?? "Capture some entries first.");
      }
    } catch (e) {
      Alert.alert("Couldn't refresh memory", (e as Error).message);
    } finally {
      setRefreshing(false);
    }
  };

  // Configured providers (in priority order) first, then the rest.
  const display: ProviderId[] = [
    ...order,
    ...PROVIDERS.map((p) => p.id).filter((id) => !order.includes(id)),
  ];

  const move = (id: ProviderId, dir: -1 | 1) => {
    setOrder((prev) => {
      const idx = prev.indexOf(id);
      if (idx < 0) return prev;
      const swap = idx + dir;
      if (swap < 0 || swap >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[swap]] = [next[swap], next[idx]];
      return next;
    });
  };

  const save = async () => {
    const result: ProviderKey[] = [];
    const seen = new Set<ProviderId>();
    // configured providers keep their priority order…
    for (const id of order) {
      const v = (drafts[id] ?? "").trim();
      if (v) {
        result.push({ provider: id, apiKey: v });
        seen.add(id);
      }
    }
    // …then any provider that just got its first key, appended at lower priority
    for (const p of PROVIDERS) {
      const v = (drafts[p.id] ?? "").trim();
      if (v && !seen.has(p.id)) result.push({ provider: p.id, apiKey: v });
    }
    await setProviderKeys(result);
    setOrder(result.map((k) => k.provider));
    Alert.alert(
      "Saved",
      result.length
        ? "Keys stored securely on this device. Models are tried in priority order, falling back to the next on failure."
        : "All keys removed."
    );
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.label}>Signed in as</Text>
      <Text style={styles.value}>{session?.user.email ?? session?.user.phone}</Text>

      <Text style={[styles.label, styles.section]}>AI provider keys</Text>
      <Text style={styles.hint}>
        Add a key for any provider. They are stored only on this device and tried
        top-to-bottom — if the first fails, the next is used automatically.
      </Text>

      {display.map((id) => {
        const meta = PROVIDERS.find((p) => p.id === id)!;
        const priority = order.indexOf(id);
        const configured = priority >= 0;
        const isFirst = priority === 0;
        const isLast = priority === order.length - 1;
        return (
          <View key={id} style={styles.providerCard}>
            <View style={styles.providerHeader}>
              <Text style={styles.providerLabel}>{meta.label}</Text>
              {configured && (
                <View style={styles.priorityRow}>
                  <Text style={styles.priorityBadge}>#{priority + 1}</Text>
                  <TouchableOpacity
                    onPress={() => move(id, -1)}
                    disabled={isFirst}
                    hitSlop={8}
                  >
                    <Text style={[styles.arrow, isFirst && styles.arrowOff]}>↑</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => move(id, 1)}
                    disabled={isLast}
                    hitSlop={8}
                  >
                    <Text style={[styles.arrow, isLast && styles.arrowOff]}>↓</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
            <TextInput
              style={styles.input}
              placeholder={meta.placeholder}
              placeholderTextColor={colors.muted}
              autoCapitalize="none"
              autoCorrect={false}
              secureTextEntry
              value={drafts[id] ?? ""}
              onChangeText={(t) => setDrafts((d) => ({ ...d, [id]: t }))}
            />
            <Text style={styles.providerHint}>Get a key at {meta.getKeyUrl}</Text>
          </View>
        );
      })}

      <TouchableOpacity style={styles.primary} onPress={save}>
        <Text style={styles.primaryText}>Save keys</Text>
      </TouchableOpacity>

      <Text style={[styles.label, styles.section]}>Long-term memory</Text>
      <Text style={styles.hint}>
        A running profile of your themes, goals, and recurring ideas, distilled
        from your entries and used to personalize every answer. Refresh it after
        you've added new thinking.
      </Text>
      {memory ? (
        <View style={styles.memoryBox}>
          <Text style={styles.memoryText}>{memory}</Text>
        </View>
      ) : (
        <Text style={styles.memoryEmpty}>No memory profile yet.</Text>
      )}
      <TouchableOpacity
        style={[styles.secondaryBtn, refreshing && styles.disabled]}
        onPress={refreshMemoryProfile}
        disabled={refreshing}
      >
        {refreshing ? (
          <ActivityIndicator color={colors.accent} />
        ) : (
          <Text style={styles.secondaryBtnText}>{memory ? "Refresh memory" : "Build memory profile"}</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.signOut}
        onPress={async () => {
          try {
            await signOut();
            router.replace("/(auth)/sign-in");
          } catch (e) {
            Alert.alert("Sign out failed", (e as Error).message);
          }
        }}
      >
        <Text style={styles.signOutText}>Sign out</Text>
      </TouchableOpacity>

      <Text style={[styles.label, styles.section]}>Danger Zone</Text>
      <Text style={styles.hint}>
        Permanently delete your account and all associated data. This action cannot be undone.
      </Text>
      <TouchableOpacity
        style={[styles.deleteAccountBtn, deleting && styles.disabled]}
        onPress={async () => {
          if (deleting) return;

          Alert.alert(
            "Delete Account",
            "Are you absolutely sure? This will permanently delete:\n\n• All your entries and notes\n• Knowledge chunks and embeddings\n• Memory profile\n• Account settings\n\nThis action CANNOT be undone.\n\nA confirmation email will be sent to your email address.",
            [
              { text: "Cancel", style: "cancel" },
              {
                text: "Delete My Account",
                style: "destructive",
                onPress: async () => {
                  // Double confirmation
                  Alert.alert(
                    "Final Confirmation",
                    "This is your last chance. Are you 100% sure you want to delete your account and all data forever?",
                    [
                      { text: "Cancel", style: "cancel" },
                      {
                        text: "Yes, Delete Everything",
                        style: "destructive",
                        onPress: async () => {
                          setDeleting(true);
                          try {
                            const result = await deleteAccount();

                            // Sign out clears the local session and triggers
                            // the onAuthStateChange listener to redirect automatically.
                            await signOut();

                            // Redirect to sign-in immediately
                            router.replace("/(auth)/sign-in");

                            // Show success message after redirect
                            setTimeout(() => {
                              Alert.alert(
                                "Account Deleted",
                                result.email_sent
                                  ? "Your account will be deleted and you will receive a confirmation email. All your data has been permanently removed."
                                  : "Your account will be deleted. All your data has been permanently removed."
                              );
                            }, 500);
                          } catch (e) {
                            setDeleting(false);
                            Alert.alert(
                              "Deletion Failed",
                              (e as Error).message || "Could not delete account. Please try again or contact support."
                            );
                          }
                        },
                      },
                    ]
                  );
                },
              },
            ]
          );
        }}
        disabled={deleting}
      >
        {deleting ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.deleteAccountText}>Delete My Account</Text>
        )}
      </TouchableOpacity>

      <Text style={styles.version}>WisdomBase v1.0.0</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 20 },
  label: { fontSize: 13, color: colors.muted, textTransform: "uppercase", letterSpacing: 0.5 },
  value: { fontSize: 17, color: colors.text, marginTop: 4 },
  section: { marginTop: 28 },
  hint: { fontSize: 13, color: colors.muted, lineHeight: 19, marginTop: 6, marginBottom: 14 },
  providerCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
  },
  providerHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  providerLabel: { fontSize: 15, fontWeight: "600", color: colors.text },
  priorityRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  priorityBadge: { fontSize: 12, fontWeight: "700", color: colors.accent },
  arrow: { fontSize: 18, color: colors.accent, fontWeight: "700" },
  arrowOff: { color: colors.border },
  input: {
    backgroundColor: colors.bg,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    color: colors.text,
  },
  providerHint: { fontSize: 12, color: colors.muted, marginTop: 6 },
  primary: { backgroundColor: colors.accent, borderRadius: 12, padding: 14, alignItems: "center", marginTop: 4 },
  primaryText: { color: "#fff", fontWeight: "600" },
  memoryBox: {
    backgroundColor: colors.tealSoft,
    borderColor: colors.border,
    borderLeftWidth: 4,
    borderLeftColor: colors.teal,
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
  },
  memoryText: { color: colors.aiText, fontSize: 14, lineHeight: 21 },
  memoryEmpty: { color: colors.muted, fontSize: 14, marginBottom: 12, fontStyle: "italic" },
  secondaryBtn: {
    borderColor: colors.accent,
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    alignItems: "center",
  },
  secondaryBtnText: { color: colors.accent, fontWeight: "600" },
  disabled: { opacity: 0.5 },
  signOut: { marginTop: 36, padding: 14, alignItems: "center" },
  signOutText: { color: colors.danger, fontSize: 16, fontWeight: "600" },
  deleteAccountBtn: {
    backgroundColor: colors.danger,
    borderRadius: 12,
    padding: 14,
    alignItems: "center",
    marginTop: 8,
  },
  deleteAccountText: { color: "#fff", fontSize: 15, fontWeight: "600" },
  version: { textAlign: "center", color: colors.muted, marginTop: 20, marginBottom: 40, fontFamily: fonts.serif },
});
