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
  const date = formatEntryDate(entry.created_at);
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

      <Text style={styles.preview} numberOfLines={4}>
        {entry.content}
      </Text>

      <View style={styles.footer}>
        <Text style={styles.date}>{date}</Text>
        {group ? (
          <View style={[styles.groupPill, isGeneric && styles.groupPillGeneric]}>
            <Text style={[styles.groupPillText, isGeneric && styles.groupPillTextGeneric]}>
              {group}
            </Text>
          </View>
        ) : null}
      </View>

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
      borderRadius: 24,
      padding: 18,
      marginBottom: 14,
      borderWidth: 1,
      borderColor: colors.border,
      shadowColor: colors.bg,
      shadowOpacity: 0.3,
      shadowOffset: { width: 0, height: 16 },
      shadowRadius: 20,
      elevation: 4,
    },
    selectedCard: {
      borderColor: colors.accent,
      backgroundColor: colors.surfaceSoft,
    },
    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 12,
      gap: 10,
    },
    title: { fontSize: 19, fontWeight: "800", color: colors.text, flex: 1 },
    selectedLabel: { color: colors.accent, fontSize: 12, fontWeight: "700" },
    preview: { fontSize: 15, color: colors.muted, fontFamily: fonts.serif, lineHeight: 23 },
    footer: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginTop: 14,
    },
    groupPill: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 12,
      backgroundColor: colors.surfaceSoft,
    },
    groupPillGeneric: { backgroundColor: colors.tealSoft },
    groupPillText: { fontSize: 11, fontWeight: "700", color: colors.accent },
    groupPillTextGeneric: { color: colors.teal },
    date: { fontSize: 12, color: colors.muted, fontWeight: "600" },
    tags: { fontSize: 12, color: colors.teal, marginTop: 10, fontWeight: "700" },
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
