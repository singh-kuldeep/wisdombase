import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import type { Source } from "../lib/api";
import { colors, fonts } from "../theme";

export default function SourceCard({
  source,
  onPress,
}: {
  source: Source;
  onPress?: () => void;
}) {
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

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    marginTop: 6,
  },
  header: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  title: { fontWeight: "600", color: colors.text, flex: 1, marginRight: 8 },
  date: { color: colors.muted, fontSize: 12 },
  snippet: { color: colors.muted, fontFamily: fonts.serif, fontSize: 13, lineHeight: 19 },
});
