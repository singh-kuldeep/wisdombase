import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { fetchEntry, deleteEntries, type Entry } from "../../../lib/api";
import { colors, fonts } from "../../../theme";

export default function EntryDetail() {
  const params = useLocalSearchParams();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const router = useRouter();
  const [entry, setEntry] = useState<Entry | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    fetchEntry(id as string)
      .then((data) => setEntry(data))
      .catch((error) => {
        Alert.alert("Unable to load entry", (error as Error).message);
      })
      .finally(() => setLoading(false));
  }, [id]);

  const handleBack = () => {
    router.back?.();
  };

  const confirmDelete = async () => {
    if (!entry?.id) return;

    const shouldDelete =
      Platform.OS === "web" && typeof window !== "undefined"
        ? window.confirm("Delete this entry? This cannot be undone.")
        : await new Promise<boolean>((resolve) => {
            Alert.alert(
              "Delete entry",
              "Delete this entry? This cannot be undone.",
              [
                { text: "Cancel", style: "cancel", onPress: () => resolve(false) },
                { text: "Delete", style: "destructive", onPress: () => resolve(true) },
              ],
            );
          });

    if (!shouldDelete) return;

    setDeleting(true);
    try {
      await deleteEntries([entry.id]);
      router.replace("/(app)/browse");
    } catch (error) {
      Alert.alert("Delete failed", (error as Error).message);
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  }

  if (!entry) {
    return (
      <View style={styles.container}>
        <Text style={styles.empty}>Entry not found.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <TouchableOpacity style={styles.backButton} onPress={handleBack}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.deleteButton} onPress={confirmDelete} disabled={deleting}>
          <Text style={styles.deleteButtonText}>{deleting ? "Deleting…" : "Delete"}</Text>
        </TouchableOpacity>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>{entry.title ?? "Untitled"}</Text>
        <Text style={styles.date}>{entry.created_at.slice(0, 10)}</Text>
        <Text style={styles.body}>{entry.content}</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: 18 },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: colors.bg },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  backButton: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: 12, backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 },
  backButtonText: { color: colors.text, fontWeight: "700" },
  deleteButton: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: 12, backgroundColor: colors.accent },
  deleteButtonText: { color: "#fff", fontWeight: "700" },
  content: { paddingBottom: 30 },
  title: { fontSize: 24, fontWeight: "700", color: colors.text, marginBottom: 10 },
  date: { fontSize: 12, color: colors.muted, marginBottom: 18 },
  body: { fontSize: 16, lineHeight: 24, color: colors.text, fontFamily: fonts.serif },
  empty: { color: colors.muted, fontSize: 16 },
});
