import React, { ComponentProps, useEffect, useMemo, useCallback } from "react";
import {
  FlatList,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";
import { useRouter } from "expo-router";
import type { Entry } from "../../lib/api";
import { useEntries } from "../../stores/entryStore";
import { useTheme } from "../theme-context";
import { colors, fonts } from "../../theme";
import { Feather } from "@expo/vector-icons";

function Icon({ name, focused }: { name: ComponentProps<typeof Feather>["name"]; focused: boolean }) {
  const { colors } = useTheme();
  return <Feather name={name} size={20} color={focused ? colors.accent : colors.muted} />;
}

function WisdomTile({ entry, onPress, styles }: { entry: Entry; onPress: () => void; styles: ReturnType<typeof createStyles> }) {
  const title = entry.title?.trim() || entry.content.split("\n")[0].slice(0, 50) || "Untitled";
  const group = entry.group_name?.trim();
  const isGeneric = group?.toLowerCase() === "generic";
  return (
    <TouchableOpacity style={styles.tile} onPress={onPress} activeOpacity={0.8}>
      {group ? (
        <View style={[styles.tilePill, isGeneric && styles.tilePillGeneric]}>
          <Text style={[styles.tilePillText, isGeneric && styles.tilePillTextGeneric]}>
            {group}
          </Text>
        </View>
      ) : null}
      <Text style={styles.tileTitle} numberOfLines={2}>
        {title}
      </Text>
      <Text style={styles.tileBody} numberOfLines={3}>
        {entry.content}
      </Text>
      <Text style={styles.tileDate}>{entry.created_at.slice(0, 10)}</Text>
    </TouchableOpacity>
  );
}

export default function Home() {
  const router = useRouter();
  const { entries, loading, load } = useEntries();
  const { colors } = useTheme();
  const { width: screenWidth } = useWindowDimensions();

  useEffect(() => {
    //load();
  }, []);

  const styles = useMemo(() => createStyles(colors, screenWidth), [colors, screenWidth]);
  const topWisdom = entries.slice(0, 10);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Quick-action card */}
      <View style={styles.quickCard}>
        {/* Capture bar */}
        <TouchableOpacity style={styles.quickRow} onPress={() => router.push("/(app)/capture")} activeOpacity={0.75}>
          <View style={styles.quickAddBtn}>
            <Feather name="plus" size={18} color={colors.accent} />
          </View>
          <Text style={styles.quickPlaceholder}>Type your wisdom…</Text>
          <View style={styles.quickSendBtn}>
            <Feather name="arrow-right" size={16} color={colors.accent} />
          </View>
        </TouchableOpacity>

        <View style={styles.quickDivider} />

        {/* Ask bar */}
        <TouchableOpacity style={styles.quickRow} onPress={() => router.push("/(app)/ask")} activeOpacity={0.75}>
          <Text style={[styles.quickPlaceholder, { flex: 1 }]}>Ask your wisdom…</Text>
          <View style={styles.quickSendBtn}>
            <Feather name="arrow-right" size={16} color={colors.accent} />
          </View>
        </TouchableOpacity>
      </View>

      {/* Recent captures */}
      {/* <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Recent captures</Text>
        <TouchableOpacity onPress={() => router.push("/(app)/browse")}>
          <Text style={styles.seeAll}>See all</Text>
        </TouchableOpacity>
      </View>

      {topWisdom.length > 0 ? (
        <FlatList
          horizontal
          data={topWisdom}
          keyExtractor={(e) => e.id}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.carousel}
          renderItem={({ item }) => (
            <WisdomTile entry={item} onPress={() => router.push(`/(app)/browse/${item.id}`)} styles={styles} />
          )}
        />
      ) : (
        <Text style={styles.empty}>
          {loading ? "Loading your knowledge…" : "Capture your first thought to see it here."}
        </Text>
      )} */}
    </ScrollView>
  );
}

type ThemeColors = typeof colors;

const createStyles = (colors: ThemeColors, screenWidth: number) => {
  // Determine a responsive tile width based on available screen width.
  // Keep gaps/padding in mind: content padding is 20 on each side and
  // carousel gap is ~14 between tiles. We'll compute columns dynamically.
  const contentPadding = 40; // left+right padding from container
  const gap = 14; // gap between tiles in carousel
  let columns = 1;
  if (screenWidth >= 1100) columns = 4;
  else if (screenWidth >= 800) columns = 3;
  else if (screenWidth >= 480) columns = 2;

  const tileWidth = Math.floor((screenWidth - contentPadding - (columns - 1) * gap) / columns);

  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    content: { padding: 20, paddingBottom: 36 },

    /* Quick-action card */
    quickCard: {
      backgroundColor: colors.surface,
      borderRadius: 22,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 16,
      paddingVertical: 6,
      marginBottom: 28,
      shadowColor: colors.text,
      shadowOpacity: 0.07,
      shadowOffset: { width: 0, height: 10 },
      shadowRadius: 18,
      elevation: 4,
    },
    quickRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 14,
      gap: 12,
    },
    quickDivider: {
      height: 1,
      backgroundColor: colors.surfaceMuted,
    },
    quickAddBtn: {
      width: 34,
      height: 34,
      borderRadius: 17,
      borderWidth: 1.5,
      borderColor: colors.accent,
      borderStyle: "dashed",
      alignItems: "center",
      justifyContent: "center",
    },
    quickPlaceholder: {
      flex: 1,
      fontSize: 15,
      color: colors.muted,
    },
    quickSendBtn: {
      width: 30,
      height: 30,
      borderRadius: 15,
      backgroundColor: colors.accentSoft,
      alignItems: "center",
      justifyContent: "center",
    },

    /* Section */
    sectionHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 14,
    },
    sectionTitle: { fontSize: 18, fontWeight: "700", color: colors.text },
    seeAll: { fontSize: 14, color: colors.accent, fontWeight: "700" },

    /* Carousel */
    carousel: { gap: 14, paddingRight: 8, paddingBottom: 4 },
    tile: {
      width: tileWidth,
      backgroundColor: colors.surface,
      borderRadius: 20,
      padding: 16,
      minHeight: 144,
      borderWidth: 1,
      borderColor: colors.border,
      shadowColor: colors.text,
      shadowOpacity: 0.06,
      shadowOffset: { width: 0, height: 3 },
      shadowRadius: 3,
      elevation: 4,
    },
    tilePill: {
      alignSelf: "flex-start",
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 10,
      backgroundColor: colors.accentSoft,
      marginBottom: 8,
    },
    tilePillGeneric: { backgroundColor: colors.tealSoft },
    tilePillText: { fontSize: 10, fontWeight: "700", color: colors.accent },
    tilePillTextGeneric: { color: colors.teal },
    tileTitle: { fontSize: 15, fontWeight: "800", color: colors.text, marginBottom: 6 },
    tileBody: { fontSize: 13, color: colors.muted, lineHeight: 20, fontFamily: fonts.serif, flex: 1 },
    tileDate: { fontSize: 12, color: colors.muted, marginTop: 12 },
    empty: { color: colors.muted, fontSize: 15, fontFamily: fonts.serif, paddingVertical: 20, textAlign: "center" },
  })};
