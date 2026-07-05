import { useEffect } from "react";
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
import { colors, fonts } from "../../theme";

function WisdomTile({ entry, onPress }: { entry: Entry; onPress: () => void }) {
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

  useEffect(() => {
    load();
  }, []);

  const topWisdom = entries.slice(0, 10);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.greeting}>Your wisdom</Text>
      <Text style={styles.sub}>Revisit what you've captured, then ask it anything.</Text>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Past wisdom</Text>
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
            <WisdomTile entry={item} onPress={() => router.push(`/(app)/browse/${item.id}`)} />
          )}
        />
      ) : (
        <Text style={styles.empty}>
          {loading ? "Loading your wisdom…" : "Capture your first thought to see it here."}
        </Text>
      )}

      <View style={styles.actions}>
        <TouchableOpacity style={styles.primaryAction} onPress={() => router.push("/(app)/capture")}>
          <Text style={styles.primaryActionText}>✎  Capture a thought</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.secondaryAction} onPress={() => router.push("/(app)/ask")}>
          <Text style={styles.secondaryActionText}>✦  Ask your thinking</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const TILE_WIDTH = 168;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 20, paddingBottom: 32 },
  greeting: { fontSize: 30, fontFamily: fonts.serif, color: colors.text },
  sub: { fontSize: 15, color: colors.muted, marginTop: 6, lineHeight: 21 },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 28,
    marginBottom: 12,
  },
  sectionTitle: { fontSize: 18, fontWeight: "700", color: colors.text },
  seeAll: { fontSize: 14, color: colors.accent, fontWeight: "600" },
  carousel: { gap: 12, paddingRight: 8, paddingBottom: 4 },
  tile: {
    width: TILE_WIDTH,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderLeftWidth: 3,
    borderLeftColor: colors.teal,
    borderRadius: 12,
    padding: 12,
    minHeight: 120,
  },
  tilePill: {
    alignSelf: "flex-start",
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: colors.accentSoft,
    marginBottom: 6,
  },
  tilePillGeneric: { backgroundColor: colors.tealSoft },
  tilePillText: { fontSize: 10, fontWeight: "700", color: colors.accent },
  tilePillTextGeneric: { color: colors.teal },
  tileTitle: { fontSize: 14, fontWeight: "700", color: colors.text, marginBottom: 4 },
  tileBody: { fontSize: 12.5, color: colors.muted, lineHeight: 18, fontFamily: fonts.serif, flex: 1 },
  tileDate: { fontSize: 11, color: colors.muted, marginTop: 8 },
  empty: { color: colors.muted, fontSize: 15, fontFamily: fonts.serif, paddingVertical: 20 },
  actions: { marginTop: 32, gap: 12 },
  primaryAction: { backgroundColor: colors.accent, borderRadius: 14, padding: 16, alignItems: "center" },
  primaryActionText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  secondaryAction: {
    borderColor: colors.accent,
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
    alignItems: "center",
  },
  secondaryActionText: { color: colors.accent, fontWeight: "700", fontSize: 16 },
});
