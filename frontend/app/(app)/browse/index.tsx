import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  FlatList,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import EntryCard from "../../../components/EntryCard";
import { deleteEntries } from "../../../lib/api";
import { useEntries } from "../../../stores/entryStore";
import { colors, fonts } from "../../../theme";

export default function Browse() {
  const router = useRouter();
  const { entries, loading, load } = useEntries();
  const [search, setSearch] = useState("");
  const [groupFilter, setGroupFilter] = useState<string | null>(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    load();
  }, []);

  const groups = useMemo(() => {
    const set = new Set<string>();
    entries.forEach((e) => {
      if (e.group_name) set.add(e.group_name);
    });
    return Array.from(set);
  }, [entries]);

  const filtered = useMemo(() => {
    let list = entries;
    if (groupFilter) list = list.filter((e) => e.group_name === groupFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((e) =>
        `${e.title ?? ""} ${e.content} ${(e.tags ?? []).join(" ")}`.toLowerCase().includes(q),
      );
    }
    return list;
  }, [entries, search, groupFilter]);

  const toggleSelection = useCallback((entryId: string) => {
    setSelectionMode(true);
    setSelectedIds((current) =>
      current.includes(entryId) ? current.filter((id) => id !== entryId) : [...current, entryId],
    );
  }, []);

  const handlePress = useCallback(
    (entryId: string) => {
      if (selectionMode) {
        toggleSelection(entryId);
      } else {
        router.push(`/(app)/browse/${entryId}`);
      }
    },
    [router, selectionMode, toggleSelection],
  );

  const handleDelete = async () => {
    if (!selectedIds.length) return;

    const message =
      "Delete " +
      selectedIds.length +
      " selected entr" +
      (selectedIds.length === 1 ? "y" : "ies") +
      "? This cannot be undone.";

    const shouldDelete =
      Platform.OS === "web" && typeof window !== "undefined"
        ? window.confirm(message)
        : await new Promise<boolean>((resolve) => {
            Alert.alert("Delete entries", message, [
              { text: "Cancel", style: "cancel", onPress: () => resolve(false) },
              { text: "Delete", style: "destructive", onPress: () => resolve(true) },
            ]);
          });

    if (!shouldDelete) return;

    setDeleting(true);
    try {
      await deleteEntries(selectedIds);
      setSelectedIds([]);
      setSelectionMode(false);
      load();
    } catch (error) {
      Alert.alert("Delete failed", (error as Error).message);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.toolbar}>
        <TextInput
          style={styles.search}
          placeholder="Search your entries"
          placeholderTextColor={colors.muted}
          value={search}
          onChangeText={setSearch}
        />
        <TouchableOpacity
          style={[styles.actionButton, selectionMode && styles.actionButtonActive]}
          onPress={() => {
            setSelectionMode((value) => {
              if (value) {
                setSelectedIds([]);
              }
              return !value;
            });
          }}
        >
          <Text style={styles.actionButtonText}>{selectionMode ? "Cancel" : "Select"}</Text>
        </TouchableOpacity>
        {selectionMode ? (
          <TouchableOpacity
            style={[styles.actionButton, styles.deleteButton, selectedIds.length === 0 && styles.disabled]}
            onPress={handleDelete}
            disabled={!selectedIds.length || deleting}
          >
            <Text style={[styles.actionButtonText, styles.deleteButtonText]}>
              {selectedIds.length ? "Delete (" + selectedIds.length + ")" : "Delete"}
            </Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {groups.length > 1 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
        >
          {[null, ...groups].map((g) => {
            const active = groupFilter === g;
            return (
              <TouchableOpacity
                key={g ?? "all"}
                style={[styles.filterChip, active && styles.filterChipActive]}
                onPress={() => setGroupFilter(g)}
              >
                <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>
                  {g ?? "All"}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      ) : null}

      <FlatList
        data={filtered}
        keyExtractor={(e) => e.id}
        renderItem={({ item }) => (
          <EntryCard
            entry={item}
            onPress={() => handlePress(item.id)}
            onLongPress={() => toggleSelection(item.id)}
            selected={selectedIds.includes(item.id)}
          />
        )}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.accent} />}
        ListEmptyComponent={
          !loading ? (
            <Text style={styles.empty}>
              Your knowledge base is growing. Keep adding thoughts.
            </Text>
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  toolbar: { flexDirection: "row", alignItems: "center", paddingHorizontal: 14, gap: 10, paddingVertical: 10 },
  search: {
    flex: 1,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    fontSize: 15,
    color: colors.text,
  },
  actionButton: {
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
  },
  actionButtonActive: { backgroundColor: colors.accentSoft, borderColor: colors.accent },
  actionButtonText: { color: colors.text, fontWeight: "700" },
  filterRow: { gap: 8, paddingHorizontal: 14, paddingBottom: 10 },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  filterChipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  filterChipText: { color: colors.muted, fontWeight: "600", fontSize: 13 },
  filterChipTextActive: { color: "#fff" },
  deleteButton: { backgroundColor: colors.accent, borderColor: colors.accent },
  deleteButtonText: { color: "#fff" },
  list: { padding: 14, paddingTop: 0, flexGrow: 1 },
  empty: { textAlign: "center", color: colors.muted, marginTop: 60, fontFamily: fonts.serif, fontSize: 16, paddingHorizontal: 30 },
  disabled: { opacity: 0.5 },
});
