import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useCustomAlert } from "../../../components/CustomAlert";
import { fetchEntry, deleteEntries, type Entry } from "../../../lib/api";
import NoteEditorModal from "../../../components/NoteEditorModal";
import { useTheme } from "../../theme-context";
import { fonts } from "../../../theme";

export default function EntryDetail() {
  const params = useLocalSearchParams();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const router = useRouter();
  const { showAlert, showConfirm } = useCustomAlert();
  const [entry, setEntry] = useState<Entry | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [showEditor, setShowEditor] = useState(false);
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  useEffect(() => {
    if (!id) return;
    const entryId = id as string;
    setLoading(true);
    fetchEntry(entryId)
      .then((data) => setEntry(data))
      .catch((error) => {
        showAlert({ title: "Unable to load entry", message: (error as Error).message });
      })
      .finally(() => setLoading(false));
  }, [id]);

  const refreshEntry = async () => {
    if (!id) return;
    const data = await fetchEntry(id as string);
    setEntry(data);
  };

  const handleBack = () => {
    router.back?.();
  };

  const confirmDelete = async () => {
    if (!entry?.id) return;

    const shouldDelete = await showConfirm({
      title: "Delete entry",
      message: "Delete this entry? This cannot be undone.",
      confirmText: "Delete",
      cancelText: "Cancel",
      destructive: true,
    });

    if (!shouldDelete) return;

    setDeleting(true);
    try {
      await deleteEntries([entry.id]);
      router.replace("/(app)/browse");
    } catch (error) {
      await showAlert({ title: "Delete failed", message: (error as Error).message });
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
        <View style={styles.actionsRow}>
          <TouchableOpacity style={styles.editButton} onPress={() => setShowEditor(true)}>
            <Text style={styles.editButtonText}>Edit</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.deleteButton} onPress={confirmDelete} disabled={deleting}>
            <Text style={styles.deleteButtonText}>{deleting ? "Deleting…" : "Delete"}</Text>
          </TouchableOpacity>
        </View>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>{entry.title ?? "Untitled"}</Text>
        <Text style={styles.date}>{formatEntryDate(entry.created_at)}</Text>
        <Text style={styles.body}>{entry.content}</Text>
      </ScrollView>

      <NoteEditorModal
        visible={showEditor}
        onClose={() => setShowEditor(false)}
        mode="edit"
        entryId={entry.id}
        initialTitle={entry.title ?? ""}
        initialContent={entry.content}
        initialTags={entry.tags ?? []}
        initialGroup={entry.group_name ?? null}
        onSaved={() => {
          refreshEntry().catch((error) =>
            showAlert({ title: "Unable to refresh entry", message: (error as Error).message }),
          );
        }}
      />
    </View>
  );
}

function createStyles(colors: typeof import("../../../theme").colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg, padding: 18 },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: colors.bg },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  actionsRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  backButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 16,
    backgroundColor: colors.surface,
    borderColor: colors.surfaceMuted,
    borderWidth: 1,
  },
  backButtonText: { color: colors.text, fontWeight: "700" },
  editButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 16,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
  },
  editButtonText: { color: colors.text, fontWeight: "700" },
  deleteButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 16,
    backgroundColor: colors.accent,
  },
  deleteButtonText: { color: "#fff", fontWeight: "700" },
  content: { paddingBottom: 30, backgroundColor: colors.surface, borderRadius: 24, padding: 22, borderWidth: 1, borderColor: colors.surfaceMuted },
  title: { fontSize: 26, fontWeight: "800", color: colors.text, marginBottom: 10 },
  date: { fontSize: 13, color: colors.muted, marginBottom: 18 },
  body: { fontSize: 16, lineHeight: 26, color: colors.text, fontFamily: fonts.serif },
  empty: { color: colors.muted, fontSize: 16 },
  });
}

function formatEntryDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value.slice(0, 10);
  }

  const weekday = new Intl.DateTimeFormat(undefined, { weekday: "long" }).format(date);
  const day = new Intl.DateTimeFormat(undefined, { day: "numeric" }).format(date);
  const month = new Intl.DateTimeFormat(undefined, { month: "short" }).format(date);

  return `${weekday}, ${day} ${month}`;
}
