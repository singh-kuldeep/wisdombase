import React, { ComponentProps, useEffect, useMemo } from "react";
import {
  FlatList,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
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

  useEffect(() => {
    load();
  }, []);

  const styles = useMemo(() => createStyles(colors), [colors]);
  const topWisdom = entries.slice(0, 10);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* <View style={styles.topBar}>
        <View>
          <Text style={styles.greeting}>Your wisdom</Text>
          <Text style={styles.sub}>Revisit what you've captured, then ask it anything.</Text>
        </View>
      </View> */}

      <View style={styles.hero}>
        
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <View style={styles.heroBadge}>
          <Text style={styles.heroBadgeText}>
            <Icon name="star" focused={true} />
          </Text>
        </View>
          <Text style={styles.heroTitle}>Your wisdom</Text>
        </View>
       
        <Text style={styles.heroSubtitle}>
          Capture your ideas, revisit them as smart cards, and ask questions with context built from your own thinking.
        </Text>
      </View>

      <View style={styles.sectionHeader}>
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
      )}

      <View style={styles.actions}>
        <TouchableOpacity style={styles.primaryAction} onPress={() => router.push("/(app)/capture")}> 
          <Text style={styles.primaryActionText}>Capture a thought</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.secondaryAction} onPress={() => router.push("/(app)/ask")}> 
          <Text style={styles.secondaryActionText}>Ask your thinking</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.footerCard}>
        <Text style={styles.footerTitle}>Quick navigation</Text>
        <View style={styles.footerButtons}>
          <TouchableOpacity style={styles.footerButton} onPress={() => router.push("/(app)/ask")}> 
            <Text style={styles.footerButtonText}>Ask</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.footerButton} onPress={() => router.push("/(app)/capture")}> 
            <Text style={styles.footerButtonText}>Capture</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.footerButton} onPress={() => router.push("/(app)/settings")}> 
            <Text style={styles.footerButtonText}>Settings</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}

const TILE_WIDTH = 168;

type ThemeColors = typeof colors;

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    content: { padding: 20, paddingBottom: 36 },
    topBar: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
      marginBottom: 18,
      gap: 16,
    },
    greeting: { fontSize: 30, fontWeight: "800", color: colors.text, lineHeight: 36 },
    sub: { fontSize: 15, color: colors.muted, marginTop: 6, lineHeight: 22, maxWidth: 260 },
    modeButton: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: 18,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.surfaceMuted,
    },
    modeButtonText: { color: colors.text, fontWeight: "700", fontSize: 13 },
    hero: {
      backgroundColor: colors.surface,
      borderRadius: 24,
      padding: 22,
      marginBottom: 24,
      borderColor: colors.border,
      borderWidth: 1,
      shadowColor: colors.text,
      shadowOpacity: 0.08,
      shadowOffset: { width: 0, height: 15 },
      shadowRadius: 25,
      elevation: 6,
    },
    heroBadge: {
      width: 44,
      height: 44,
      borderRadius: 16,
      backgroundColor: colors.tealSoft,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 0,
    },
    heroBadgeText: { fontSize: 22 },
    heroTitle: { fontSize: 26, fontWeight: "800", color: colors.text, lineHeight: 34 },
    heroSubtitle: { fontSize: 15, color: colors.muted, marginTop: 10, lineHeight: 22 },
    sectionHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 14,
    },
    sectionTitle: { fontSize: 18, fontWeight: "700", color: colors.text },
    seeAll: { fontSize: 14, color: colors.accent, fontWeight: "700" },
    carousel: { gap: 14, paddingRight: 8, paddingBottom: 4 },
    tile: {
      width: TILE_WIDTH,
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
    actions: { marginTop: 32, gap: 12 },
    primaryAction: {
      backgroundColor: colors.accent,
      borderRadius: 16,
      paddingVertical: 16,
      alignItems: "center",
      shadowColor: colors.accent,
      shadowOpacity: 0.18,
      shadowOffset: { width: 0, height: 12 },
      shadowRadius: 20,
      elevation: 4,
    },
    primaryActionText: { color: "#fff", fontWeight: "700", fontSize: 16 },
    secondaryAction: {
      borderColor: colors.accent,
      borderWidth: 1,
      borderRadius: 16,
      paddingVertical: 16,
      alignItems: "center",
    },
    secondaryActionText: { color: colors.accent, fontWeight: "700", fontSize: 16 },
    footerCard: {
      marginTop: 30,
      backgroundColor: colors.surface,
      borderRadius: 20,
      padding: 18,
      borderWidth: 1,
      borderColor: colors.surfaceMuted,
      shadowColor: colors.text,
      shadowOpacity: 0.06,
      shadowOffset: { width: 0, height: 12 },
      shadowRadius: 18,
      elevation: 4,
    },
    footerTitle: { fontSize: 16, fontWeight: "700", color: colors.text, marginBottom: 12 },
    footerButtons: { flexDirection: "row", gap: 10, flexWrap: "wrap" },
    footerButton: {
      flex: 1,
      minWidth: 100,
      paddingVertical: 12,
      borderRadius: 14,
      backgroundColor: colors.surfaceSoft,
      alignItems: "center",
    },
    footerButtonText: { color: colors.accent, fontWeight: "700" },
  });
