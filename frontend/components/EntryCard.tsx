import { useMemo } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import type { Entry } from "../lib/api";
import { useTheme } from "../app/theme-context";
import { fonts } from "../theme";

export default function EntryCard({
  entry,
  onPress,
  onLongPress,
  selected,
}: {
  entry: Entry;
  onPress?: () => void;
  onLongPress?: () => void;
  selected?: boolean;
}) {
  const title = entry.title?.trim() || entry.content.split("\n")[0].slice(0, 60) || "Untitled";
  const date = entry.created_at.slice(0, 10);
  const group = entry.group_name?.trim();
  const tags = (entry.tags ?? []).filter(Boolean);
  const isGeneric = group?.toLowerCase() === "generic";
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <TouchableOpacity
      style={[styles.card, selected && styles.selectedCard]}
      onPress={onPress}
      onLongPress={onLongPress}
      activeOpacity={0.7}
    >
      <View style={styles.header}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        {selected ? <Text style={styles.selectedLabel}>Selected</Text> : null}
      </View>
      <View style={styles.metaRow}>
        {group ? (
          <View style={[styles.groupPill, isGeneric && styles.groupPillGeneric]}>
            <Text style={[styles.groupPillText, isGeneric && styles.groupPillTextGeneric]}>
              {group}
            </Text>
          </View>
        ) : null}
        <Text style={styles.date}>{date}</Text>
      </View>
      <Text style={styles.preview} numberOfLines={2}>
        {entry.content}
      </Text>
      {tags.length ? (
        <Text style={styles.tags} numberOfLines={1}>
          {tags.map((t) => `#${t}`).join("  ")}
        </Text>
      ) : null}
    </TouchableOpacity>
  );
}

function createStyles(colors: typeof import("../theme").colors) {
  return StyleSheet.create({
    card: {
      backgroundColor: colors.surface,
    borderRadius: 18,
    padding: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: colors.surfaceMuted,
    shadowColor: colors.text,
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 15 },
    shadowRadius: 22,
    elevation: 5,
  },
  selectedCard: {
    borderColor: colors.accent,
    backgroundColor: colors.tealSoft,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  title: { fontSize: 18, fontWeight: "700", color: colors.text, flex: 1, marginRight: 10 },
  selectedLabel: { color: colors.accent, fontSize: 12, fontWeight: "700" },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 },
  groupPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: colors.accentSoft,
  },
  groupPillGeneric: { backgroundColor: colors.tealSoft },
  groupPillText: { fontSize: 11, fontWeight: "700", color: colors.accent },
  groupPillTextGeneric: { color: colors.teal },
  date: { fontSize: 12, color: colors.muted },
  preview: { fontSize: 14, color: colors.muted, fontFamily: fonts.serif, lineHeight: 22 },
  tags: { fontSize: 12, color: colors.teal, marginTop: 10, fontWeight: "700" },
  });
}
