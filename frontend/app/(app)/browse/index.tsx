import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Keyboard,
  Platform,
  RefreshControl,
  SectionList,
  Share,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useCustomAlert } from "../../../components/CustomAlert";
import EntryCard from "../../../components/EntryCard";
import NoteEditorModal from "../../../components/NoteEditorModal";
import { deleteEntries, fetchEntriesPage, type Entry } from "../../../lib/api";
import { useTheme } from "../../theme-context";
import { fonts } from "../../../theme";

type BrowseSection = {
  title: string;
  data: Entry[];
};

type SortMode = "date-desc" | "date-asc" | "title-asc";

export default function Browse() {
  const PAGE_SIZE = 20;
  const router = useRouter();
  const { showAlert, showConfirm } = useCustomAlert();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [nextOffset, setNextOffset] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [searchActive, setSearchActive] = useState(false);
  const [groupFilter, setGroupFilter] = useState<string | null>(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [deleting, setDeleting] = useState(false);
  const [showEditor, setShowEditor] = useState(false);
  const [sortMode, setSortMode] = useState<SortMode>("date-desc");
  const [menuVisible, setMenuVisible] = useState(false);
  const [sortMenuVisible, setSortMenuVisible] = useState(false);
  const searchInputRef = useRef<TextInput>(null);

  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(id);
  }, [search]);

  const loadInitialPage = useCallback(async () => {
    setLoading(true);
    try {
      const { entries: pageEntries, page, total_count } = await fetchEntriesPage({
        offset: 0,
        limit: PAGE_SIZE,
        group: groupFilter ?? undefined,
        q: debouncedSearch,
      });
      setEntries(pageEntries);
      setNextOffset(pageEntries.length);
      setHasMore(page?.has_more ?? pageEntries.length >= PAGE_SIZE);
      setTotalCount(total_count ?? pageEntries.length);
    } catch (error) {
      await showAlert({ title: "Load failed", message: (error as Error).message });
    } finally {
      setLoading(false);
    }
  }, [showAlert, groupFilter, debouncedSearch]);

  const loadMore = useCallback(async () => {
    if (loading || loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const { entries: pageEntries, page, total_count } = await fetchEntriesPage({
        offset: nextOffset,
        limit: PAGE_SIZE,
        group: groupFilter ?? undefined,
        q: debouncedSearch,
      });
      setEntries((prev) => [...prev, ...pageEntries]);
      setNextOffset((prev) => prev + pageEntries.length);
      setHasMore(page?.has_more ?? pageEntries.length >= PAGE_SIZE);
      setTotalCount(total_count ?? 0);
    } catch (error) {
      await showAlert({ title: "Load more failed", message: (error as Error).message });
    } finally {
      setLoadingMore(false);
    }
  }, [hasMore, loading, loadingMore, nextOffset, showAlert, groupFilter, debouncedSearch]);

  const refresh = useCallback(async () => {
    await loadInitialPage();
  }, [loadInitialPage]);

  useEffect(() => {
    loadInitialPage();
  }, [loadInitialPage]);

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

  const filtered = entries;
  const showInitialLoader = loading && entries.length === 0;
  const showSearchLoader = loading && debouncedSearch.length > 0;

  const sections = useMemo<BrowseSection[]>(() => {
    const buckets = new Map<string, Entry[]>();

    [...filtered]
      .sort((left, right) => compareEntries(left, right, sortMode))
      .forEach((entry) => {
        const key = entry.created_at.slice(0, 10);
        const current = buckets.get(key) ?? [];
        current.push(entry);
        buckets.set(key, current);
      });

    const sections = Array.from(buckets.entries()).map(([dateKey, data]) => ({
      title: formatDateLabel(dateKey),
      data,
    }));

    return sortMode === "date-asc" ? sections.reverse() : sections;
  }, [filtered, sortMode]);

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

    const shouldDelete = await showConfirm({
      title: "Delete entries",
      message,
      confirmText: "Delete",
      cancelText: "Cancel",
      destructive: true,
    });

    if (!shouldDelete) return;

    setDeleting(true);
    try {
      await deleteEntries(selectedIds);
      setSelectedIds([]);
      setSelectionMode(false);
      await refresh();
    } catch (error) {
      await showAlert({ title: "Delete failed", message: (error as Error).message });
    } finally {
      setDeleting(false);
    }
  };

  const handleExport = async () => {
    const exportedEntries = selectedIds.length
      ? filtered.filter((entry) => selectedIds.includes(entry.id))
      : filtered;

    const payload = JSON.stringify(
      exportedEntries.map((entry) => ({
        id: entry.id,
        title: entry.title,
        content: entry.content,
        source: entry.source,
        group_name: entry.group_name,
        tags: entry.tags,
        created_at: entry.created_at,
      })),
      null,
      2,
    );

    if (Platform.OS === "web") {
      const blob = new Blob([payload], { type: "application/json;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `wisdombase-entries-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      return;
    }

    await Share.share({
      title: "WisdomBase entries export",
      message: payload,
    });
  };

  const handlePrint = () => {
    if (Platform.OS === "web") {
      window.print();
      return;
    }

    showAlert({
      title: "Print unavailable",
      message: "Printing is currently supported on web only.",
    });
  };

  const handleMore = () => {
    setMenuVisible(true);
  };

  const closeMenus = () => {
    setMenuVisible(false);
    setSortMenuVisible(false);
  };

  const clearSearch = () => {
    setSearch("");
    setSearchActive(false);
    searchInputRef.current?.blur();
  };

  const exitSelectionMode = () => {
    setSelectionMode(false);
    setSelectedIds([]);
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
          <Text style={styles.headerTitle}>Wisdoms</Text>
          <Text style={styles.summary}>{totalCount} notes</Text>
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
          <TouchableOpacity style={styles.searchDoneButton} onPress={clearSearch} activeOpacity={0.85}>
            <Text style={styles.searchDoneText}>Done</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {selectionMode ? (
        <View style={styles.selectionBar}>
          <Text style={styles.selectionText}>{selectedIds.length} selected</Text>
          <View style={styles.selectionActions}>
            <TouchableOpacity style={styles.cancelIconButton} onPress={exitSelectionMode} activeOpacity={0.8}>
              <Feather name="x" size={15} color={colors.text} />
            </TouchableOpacity>
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
        ListHeaderComponent={
          showSearchLoader ? (
            <View style={styles.searchLoadingRow}>
              <ActivityIndicator color={colors.accent} size="small" />
              <Text style={styles.searchLoadingText}>Searching wisdom…</Text>
            </View>
          ) : null
        }
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor={colors.accent} />}
        onEndReachedThreshold={0.35}
        onEndReached={() => {
          void loadMore();
        }}
        ListFooterComponent={
          loadingMore ? (
            <View style={styles.loadMoreRow}>
              <ActivityIndicator color={colors.accent} size="small" />
              <Text style={styles.loadMoreText}>Loading more wisdom…</Text>
            </View>
          ) : null
        }
        ListEmptyComponent={
          showInitialLoader ? (
            <View style={styles.initialLoadingWrap}>
              <ActivityIndicator color={colors.accent} size="large" />
              <Text style={styles.initialLoadingText}>Loading wisdom…</Text>
            </View>
          ) : !loading ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>No wisdom yet</Text>
              <Text style={styles.empty}>Capture a thought to start building your collection.</Text>
            </View>
          ) : null
        }
      />

      <TouchableOpacity style={styles.fab} onPress={() => setShowEditor(true)} activeOpacity={0.85}>
        <Feather name="plus" size={30} color="#fff" />
      </TouchableOpacity>

      <Modal visible={menuVisible} transparent animationType="fade" onRequestClose={closeMenus}>
        <View style={styles.menuOverlay}>
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={closeMenus} />
          <View style={styles.menuSheet}>
            <View style={styles.menuHeaderRow}>
              <Text style={styles.menuHeaderTitle}>Browse actions</Text>
              <TouchableOpacity style={styles.cancelIconButton} onPress={closeMenus} activeOpacity={0.8}>
                <Feather name="x" size={15} color={colors.text} />
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              style={styles.menuRow}
              onPress={() => {
                setSortMenuVisible(true);
                setMenuVisible(false);
              }}
              activeOpacity={0.8}
            >
              <View style={styles.menuIcon}>
                <Text style={styles.menuGlyph}>⇅</Text>
              </View>
              <View style={styles.menuTextBlock}>
                <Text style={styles.menuTitle}>Sort By</Text>
                <Text style={styles.menuSubtitle}>{sortLabel(sortMode)}</Text>
              </View>
              <Feather name="chevron-right" size={18} color={colors.text} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.menuRow}
              onPress={() => {
                setSelectionMode(true);
                Keyboard.dismiss();
                closeMenus();
              }}
              activeOpacity={0.8}
            >
              <View style={styles.menuIcon}>
                <Feather name="check-circle" size={18} color={colors.text} />
              </View>
              <View style={styles.menuTextBlock}>
                <Text style={styles.menuTitle}>Select Entries</Text>
              </View>
            </TouchableOpacity>

            <View style={styles.menuDivider} />

            <TouchableOpacity
              style={styles.menuRow}
              onPress={() => {
                void handleExport();
                closeMenus();
              }}
              activeOpacity={0.8}
            >
              <View style={styles.menuIcon}>
                <Feather name="share-2" size={18} color={colors.text} />
              </View>
              <View style={styles.menuTextBlock}>
                <Text style={styles.menuTitle}>Export</Text>
              </View>
            </TouchableOpacity>

            {/* <TouchableOpacity
              style={styles.menuRow}
              onPress={() => {
                handlePrint();
                closeMenus();
              }}
              activeOpacity={0.8}
            >
              <View style={styles.menuIcon}>
                <Feather name="printer" size={18} color={colors.text} />
              </View>
              <View style={styles.menuTextBlock}>
                <Text style={styles.menuTitle}>Print</Text>
              </View>
            </TouchableOpacity> */}
          </View>
        </View>
      </Modal>

      <Modal visible={sortMenuVisible} transparent animationType="fade" onRequestClose={closeMenus}>
        <View style={styles.menuOverlay}>
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={closeMenus} />
          <View style={styles.menuSheet}>
            <View style={styles.menuHeaderRow}>
              <Text style={styles.menuHeaderTitle}>Sort By</Text>
              <TouchableOpacity style={styles.cancelIconButton} onPress={closeMenus} activeOpacity={0.8}>
                <Feather name="x" size={15} color={colors.text} />
              </TouchableOpacity>
            </View>
            <Text style={styles.sortTitle}>Sort By</Text>
            <TouchableOpacity
              style={[styles.sortOption, sortMode === "date-desc" && styles.sortOptionActive]}
              onPress={() => {
                setSortMode("date-desc");
                closeMenus();
              }}
              activeOpacity={0.8}
            >
              <Text style={styles.sortOptionText}>Entry Date</Text>
              <Text style={styles.sortOptionMeta}>Newest first</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.sortOption, sortMode === "date-asc" && styles.sortOptionActive]}
              onPress={() => {
                setSortMode("date-asc");
                closeMenus();
              }}
              activeOpacity={0.8}
            >
              <Text style={styles.sortOptionText}>Oldest First</Text>
              <Text style={styles.sortOptionMeta}>Earliest first</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.sortOption, sortMode === "title-asc" && styles.sortOptionActive]}
              onPress={() => {
                setSortMode("title-asc");
                closeMenus();
              }}
              activeOpacity={0.8}
            >
              <Text style={styles.sortOptionText}>Title</Text>
              <Text style={styles.sortOptionMeta}>Alphabetical</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <NoteEditorModal
        visible={showEditor}
        onClose={() => setShowEditor(false)}
        onSaved={() => {
          void refresh();
        }}
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
    searchInput: { 
      flex: 1, color: colors.text, fontSize: 15, paddingVertical: 12,
            outlineWidth: 0,
      outlineColor: "transparent",
      ...(Platform.OS === "web" ? ({ outlineStyle: "none", boxShadow: "none" } as any) : null),
     },
    cancelIconButton: {
      width: 30,
      height: 30,
      borderRadius: 15,
      backgroundColor: colors.surface,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: colors.border,
      marginLeft: 8,
    },
    searchClear: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: colors.surface,
      alignItems: "center",
      justifyContent: "center",
      marginLeft: 8,
    },
    searchDoneButton: {
      marginLeft: 10,
      paddingHorizontal: 12,
      height: 32,
      borderRadius: 16,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: "center",
      justifyContent: "center",
    },
    searchDoneText: {
      color: colors.text,
      fontSize: 13,
      fontWeight: "700",
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
    selectionActions: { flexDirection: "row", alignItems: "center", gap: 10 },
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
      fontSize: 18,
      fontWeight: "600",
      marginTop: 8,
      marginBottom: 14,
      letterSpacing: -0.3,
    },
    emptyState: { paddingTop: 56, alignItems: "center" },
    emptyTitle: { color: colors.text, fontSize: 22, fontWeight: "800", marginBottom: 8 },
    empty: { textAlign: "center", color: colors.muted, fontFamily: fonts.serif, fontSize: 16, paddingHorizontal: 30 },
    loadMoreRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 10,
      paddingTop: 8,
      paddingBottom: 20,
    },
    loadMoreText: {
      color: colors.muted,
      fontSize: 13,
      fontWeight: "600",
    },
    initialLoadingWrap: {
      paddingTop: 72,
      alignItems: "center",
      gap: 12,
    },
    initialLoadingText: {
      color: colors.muted,
      fontSize: 14,
      fontWeight: "600",
    },
    searchLoadingRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 10,
      paddingTop: 2,
      paddingBottom: 10,
    },
    searchLoadingText: {
      color: colors.muted,
      fontSize: 13,
      fontWeight: "600",
    },
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
    menuOverlay: {
      flex: 1,
      justifyContent: "flex-start",
      alignItems: "center",
      paddingTop: 72,
      paddingHorizontal: 16,
      backgroundColor: "rgba(0,0,0,0.18)",
    },
    menuSheet: {
      width: "100%",
      maxWidth: 330,
      backgroundColor: colors.surface,
      borderRadius: 28,
      borderWidth: 1,
      borderColor: colors.border,
      paddingVertical: 10,
      paddingHorizontal: 12,
      shadowColor: colors.bg,
      shadowOpacity: 0.45,
      shadowOffset: { width: 0, height: 18 },
      shadowRadius: 28,
      elevation: 10,
    },
    menuHeaderRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 10,
      paddingBottom: 6,
    },
    menuHeaderTitle: { color: colors.text, fontSize: 15, fontWeight: "800" },
    menuRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingVertical: 12,
      paddingHorizontal: 10,
      borderRadius: 18,
    },
    menuIcon: {
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: colors.surfaceSoft,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: colors.border,
    },
    menuGlyph: { color: colors.text, fontSize: 16, fontWeight: "800", lineHeight: 16 },
    menuTextBlock: { flex: 1 },
    menuTitle: { color: colors.text, fontSize: 15, fontWeight: "700" },
    menuSubtitle: { color: colors.muted, fontSize: 12, marginTop: 2 },
    menuDivider: { height: 1, backgroundColor: colors.border, marginVertical: 6, marginHorizontal: 10 },
    sortTitle: { color: colors.text, fontSize: 18, fontWeight: "800", paddingHorizontal: 10, paddingTop: 4, paddingBottom: 10 },
    sortOption: {
      borderRadius: 18,
      paddingVertical: 12,
      paddingHorizontal: 12,
      marginBottom: 8,
      backgroundColor: colors.surfaceSoft,
      borderWidth: 1,
      borderColor: colors.border,
    },
    sortOptionActive: {
      borderColor: colors.accent,
      backgroundColor: colors.accentSoft,
    },
    sortOptionText: { color: colors.text, fontSize: 15, fontWeight: "700" },
    sortOptionMeta: { color: colors.muted, fontSize: 12, marginTop: 2 },
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

function compareEntries(left: Entry, right: Entry, sortMode: SortMode) {
  if (sortMode === "title-asc") {
    const leftTitle = (left.title ?? left.content.split("\n")[0] ?? "").toLowerCase();
    const rightTitle = (right.title ?? right.content.split("\n")[0] ?? "").toLowerCase();
    return leftTitle.localeCompare(rightTitle);
  }

  const leftTime = new Date(left.created_at).getTime();
  const rightTime = new Date(right.created_at).getTime();
  return sortMode === "date-asc" ? leftTime - rightTime : rightTime - leftTime;
}

function sortLabel(sortMode: SortMode) {
  if (sortMode === "date-asc") return "Oldest First";
  if (sortMode === "title-asc") return "Title";
  return "Entry Date";
}
