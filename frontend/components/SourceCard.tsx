import { useMemo } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import type { Source } from "../lib/api";
import { useTheme } from "../app/theme-context";
import { fonts } from "../theme";

export default function SourceCard({
  source,
  onPress,
}: {
  source: Source;
  onPress?: () => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      activeOpacity={onPress ? 0.75 : 1}
      disabled={!onPress}
    >
      <View style={styles.header}>
        <Text style={styles.title} numberOfLines={1}>
          {source.title}
        </Text>
        {!!source.date && <Text style={styles.date}>{source.date}</Text>}
      </View>
      <Text style={styles.snippet} numberOfLines={3}>
        {source.snippet}
      </Text>
    </TouchableOpacity>
  );
}

function createStyles(colors: typeof import("../theme").colors) {
  return StyleSheet.create({
    card: {
      backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 14,
    marginTop: 10,
    borderWidth: 1,
    borderColor: colors.surfaceMuted,
    shadowColor: colors.text,
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 10 },
    shadowRadius: 18,
    elevation: 4,
  },
  header: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  title: { fontWeight: "700", color: colors.text, flex: 1, marginRight: 8, fontSize: 15 },
  date: { color: colors.muted, fontSize: 12 },
  snippet: { color: colors.muted, fontFamily: fonts.serif, fontSize: 14, lineHeight: 21 },
  });
}
