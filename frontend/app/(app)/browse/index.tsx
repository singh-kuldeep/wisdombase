import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Keyboard,
  Platform,
  RefreshControl,
  SectionList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import EntryCard from "../../../components/EntryCard";
import NoteEditorModal from "../../../components/NoteEditorModal";
import { deleteEntries, type Entry } from "../../../lib/api";
import { useEntries } from "../../../stores/entryStore";
import { useTheme } from "../../theme-context";
import { fonts } from "../../../theme";

type BrowseSection = {
  title: string;
  data: Entry[];
};

export default function Browse() {
  const router = useRouter();
  const { entries, loading, load } = useEntries();
  const [search, setSearch] = useState("");
  const [searchActive, setSearchActive] = useState(false);
  const [groupFilter, setGroupFilter] = useState<string | null>(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [deleting, setDeleting] = useState(false);
  const [showEditor, setShowEditor] = useState(false);
  const searchInputRef = useRef<TextInput>(null);

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (searchActive) {
      requestAnimationFrame(() => searchInputRef.current?.focus());
    }
  }, [searchActive]);

  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const groups = useMemo(() => {
    const set = new Set<string>();
    entries.forEach((entry) => {
      if (entry.group_name) set.add(entry.group_name);
    });
    return Array.from(set);
  }, [entries]);

  const filtered = useMemo(() => {
    let list = entries;
    if (groupFilter) list = list.filter((entry) => entry.group_name === groupFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((entry) =>
        `${entry.title ?? ""} ${entry.content} ${(entry.tags ?? []).join(" ")}`.toLowerCase().includes(q),
      );
    }
    return list;
  }, [entries, search, groupFilter]);

  const sections = useMemo<BrowseSection[]>(() => {
    const buckets = new Map<string, Entry[]>();

    [...filtered]
      .sort((left, right) => right.created_at.localeCompare(left.created_at))
      .forEach((entry) => {
        const key = entry.created_at.slice(0, 10);
        const current = buckets.get(key) ?? [];
        current.push(entry);
        buckets.set(key, current);
      });

    return Array.from(buckets.entries()).map(([dateKey, data]) => ({
      title: formatDateLabel(dateKey),
      data,
    }));
  }, [filtered]);

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

  const handleMore = () => {
    if (selectionMode) {
      void handleDelete();
      return;
    }

    Alert.alert("Browse actions", "Choose an action", [
      {
        text: "Select entries",
        onPress: () => {
          setSelectionMode(true);
          Keyboard.dismiss();
        },
      },
      {
        text: searchActive ? "Hide search" : "Show search",
        onPress: () => setSearchActive((value) => !value),
      },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  return (
    <View style={styles.container}>
      <View style={styles.backgroundGlowOne} />
      <View style={styles.backgroundGlowTwo} />

      <View style={styles.toolbar}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()} activeOpacity={0.8}>
          <Feather name="chevron-left" size={26} color={colors.text} />
        </TouchableOpacity>

        <View style={styles.titleBlock}>
          <Text style={styles.headerTitle}>All Entries</Text>
          <Text style={styles.summary}>{filtered.length} notes</Text>
        </View>

        <View style={styles.toolbarActions}>
          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => setSearchActive((value) => !value)}
            activeOpacity={0.8}
          >
            <Feather name="search" size={18} color={colors.text} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconButton} onPress={handleMore} activeOpacity={0.8}>
            <Feather name="more-horizontal" size={18} color={colors.text} />
          </TouchableOpacity>
        </View>
      </View>

      {searchActive || search.length ? (
        <View style={styles.searchShell}>
          <Feather name="search" size={18} color={colors.muted} style={styles.searchIcon} />
          <TextInput
            ref={searchInputRef}
            style={styles.searchInput}
            placeholder="Search entries"
            placeholderTextColor={colors.muted}
            value={search}
            onChangeText={setSearch}
            returnKeyType="search"
          />
          {search.length ? (
            <TouchableOpacity style={styles.searchClear} onPress={() => setSearch("")} activeOpacity={0.8}>
              <Feather name="x" size={16} color={colors.text} />
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}

      {selectionMode ? (
        <View style={styles.selectionBar}>
          <Text style={styles.selectionText}>{selectedIds.length} selected</Text>
          <TouchableOpacity
            style={[styles.actionButton, styles.deleteButton, selectedIds.length === 0 && styles.disabled]}
            onPress={handleDelete}
            disabled={!selectedIds.length || deleting}
          >
            <Text style={[styles.actionButtonText, styles.deleteButtonText]}>
              {deleting ? "Deleting…" : "Delete"}
            </Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {/* {groups.length > 1 ? (
        <View style={styles.filterRow}>
          <TouchableOpacity
            style={[styles.filterChip, !groupFilter && styles.filterChipActive]}
            onPress={() => setGroupFilter(null)}
            activeOpacity={0.8}
          >
            <Text style={[styles.filterChipText, !groupFilter && styles.filterChipTextActive]}>All</Text>
          </TouchableOpacity>
          {groups.map((group) => {
            const active = groupFilter === group;
            return (
              <TouchableOpacity
                key={group}
                style={[styles.filterChip, active && styles.filterChipActive]}
                onPress={() => setGroupFilter(group)}
                activeOpacity={0.8}
              >
                <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>{group}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      ) : null} */}

      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <EntryCard
            entry={item}
            onPress={() => handlePress(item.id)}
            onLongPress={() => toggleSelection(item.id)}
            selected={selectedIds.includes(item.id)}
          />
        )}
        renderSectionHeader={({ section }) => <Text style={styles.sectionLabel}>{section.title}</Text>}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.accent} />}
        ListEmptyComponent={
          !loading ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>No entries yet</Text>
              <Text style={styles.empty}>Capture a thought to start building your collection.</Text>
            </View>
          ) : null
        }
      />

      <TouchableOpacity style={styles.fab} onPress={() => setShowEditor(true)} activeOpacity={0.85}>
        <Feather name="plus" size={30} color="#fff" />
      </TouchableOpacity>

      <NoteEditorModal
        visible={showEditor}
        onClose={() => setShowEditor(false)}
      />
    </View>
  );
}

function createStyles(colors: typeof import("../../../theme").colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    backgroundGlowOne: {
      position: "absolute",
      top: -120,
      right: -90,
      width: 220,
      height: 220,
      borderRadius: 110,
      backgroundColor: colors.accentSoft,
      opacity: 0.18,
    },
    backgroundGlowTwo: {
      position: "absolute",
      top: 110,
      left: -110,
      width: 180,
      height: 180,
      borderRadius: 90,
      backgroundColor: colors.surfaceMuted,
      opacity: 0.55,
    },
    toolbar: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 18,
      paddingTop: 18,
      paddingBottom: 12,
      gap: 12,
    },
    backButton: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: colors.surfaceMuted,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: colors.border,
    },
    titleBlock: { flex: 1 },
    headerTitle: { fontSize: 18, fontWeight: "600", color: colors.text, letterSpacing: -0.4 },
    summary: { color: colors.muted, fontSize: 13, marginTop: 2 },
    toolbarActions: { flexDirection: "row", alignItems: "center", gap: 10 },
    iconButton: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: colors.surfaceMuted,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: colors.border,
    },
    searchShell: {
      marginHorizontal: 18,
      marginBottom: 8,
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.surfaceMuted,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 14,
      minHeight: 54,
    },
    searchIcon: { marginRight: 10 },
    searchInput: { flex: 1, color: colors.text, fontSize: 15, paddingVertical: 12 },
    searchClear: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: colors.surface,
      alignItems: "center",
      justifyContent: "center",
    },
    selectionBar: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      backgroundColor: colors.surfaceMuted,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 14,
      marginHorizontal: 18,
      marginBottom: 10,
    },
    selectionText: { color: colors.text, fontWeight: "700" },
    actionButton: {
      borderRadius: 16,
      paddingVertical: 11,
      paddingHorizontal: 14,
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderWidth: 1,
    },
    actionButtonText: { color: colors.text, fontWeight: "700" },
    deleteButton: { backgroundColor: colors.accent, borderColor: colors.accent },
    deleteButtonText: { color: "#fff" },
    filterRow: { flexDirection: "row", gap: 8, paddingHorizontal: 18, paddingBottom: 6 },
    filterChip: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surfaceMuted,
    },
    filterChipActive: { backgroundColor: colors.text, borderColor: colors.text },
    filterChipText: { color: colors.muted, fontWeight: "600", fontSize: 13 },
    filterChipTextActive: { color: colors.bg },
    list: { paddingHorizontal: 18, paddingTop: 10, paddingBottom: 120, flexGrow: 1 },
    sectionLabel: {
      color: colors.text,
      fontSize: 14,
      fontWeight: "600",
      marginTop: 8,
      marginBottom: 14,
      letterSpacing: -0.3,
    },
    emptyState: { paddingTop: 56, alignItems: "center" },
    emptyTitle: { color: colors.text, fontSize: 22, fontWeight: "800", marginBottom: 8 },
    empty: { textAlign: "center", color: colors.muted, fontFamily: fonts.serif, fontSize: 16, paddingHorizontal: 30 },
    disabled: { opacity: 0.5 },
    fab: {
      position: "absolute",
      right: 18,
      bottom: 26,
      width: 62,
      height: 62,
      borderRadius: 31,
      backgroundColor: colors.accent,
      alignItems: "center",
      justifyContent: "center",
      shadowColor: colors.accent,
      shadowOpacity: 0.3,
      shadowOffset: { width: 0, height: 10 },
      shadowRadius: 20,
      elevation: 6,
    },
  });
}

function formatDateLabel(dateKey: string) {
  const target = new Date(`${dateKey}T00:00:00`);
  const today = new Date();
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const startOfTarget = new Date(target.getFullYear(), target.getMonth(), target.getDate());
  const diffDays = Math.round((startOfToday.getTime() - startOfTarget.getTime()) / 86400000);

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays > 1 && diffDays < 7) {
    return new Intl.DateTimeFormat(undefined, { weekday: "long" }).format(target);
  }

  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(target);
}
