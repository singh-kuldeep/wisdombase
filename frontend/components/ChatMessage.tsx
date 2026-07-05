import { StyleSheet, Text, View } from "react-native";
import type { Source } from "../lib/api";
import { colors, fonts } from "../theme";
import SourceCard from "./SourceCard";

export type Message = {
  role: "user" | "assistant";
  content: string;
  sources?: Source[];
};

export default function ChatMessage({
  message,
  onSourcePress,
}: {
  message: Message;
  onSourcePress?: (source: Source) => void;
}) {
  const isUser = message.role === "user";
  return (
    <View style={[styles.wrap, isUser ? styles.userWrap : styles.assistantWrap]}>
      <View style={[styles.bubble, isUser ? styles.userBubble : styles.assistantBubble]}>
        <Text style={[styles.text, isUser && styles.userText]}>{message.content}</Text>
      </View>
      {!isUser && !!message.sources?.length && (
        <View style={styles.sources}>
          <Text style={styles.sourcesLabel}>From your knowledge</Text>
          {message.sources.map((s, i) => (
            <SourceCard
              key={`${s.entry_id}-${i}`}
              source={s}
              onPress={() => onSourcePress?.(s)}
            />
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginVertical: 6, maxWidth: "92%" },
  userWrap: { alignSelf: "flex-end" },
  assistantWrap: { alignSelf: "flex-start" },
  bubble: { borderRadius: 14, paddingVertical: 10, paddingHorizontal: 14 },
  userBubble: { backgroundColor: colors.accent },
  assistantBubble: {
    backgroundColor: colors.tealSoft,
    borderWidth: 1,
    borderColor: colors.border,
    borderLeftWidth: 4,
    borderLeftColor: colors.teal,
  },
  text: { color: colors.text, fontSize: 16, lineHeight: 23, fontFamily: fonts.serif },
  userText: { color: "#fff", fontFamily: fonts.sans },
  sources: { marginTop: 4 },
  sourcesLabel: { color: colors.teal, fontSize: 12, marginTop: 8, marginBottom: 2, textTransform: "uppercase", letterSpacing: 0.5 },
});
