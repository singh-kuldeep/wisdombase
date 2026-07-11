import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import type { Source } from "../lib/api";
import { useTheme } from "../app/theme-context";
import { fonts } from "../theme";
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
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
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

function createStyles(colors: typeof import("../theme").colors) {
  return StyleSheet.create({
    wrap: { marginVertical: 6, maxWidth: "92%" },
    userWrap: { alignSelf: "flex-end" },
  assistantWrap: { alignSelf: "flex-start" },
  bubble: {
    borderRadius: 22,
    paddingVertical: 14,
    paddingHorizontal: 16,
    shadowColor: colors.text,
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 10 },
    shadowRadius: 20,
    elevation: 3,
  },
  userBubble: { backgroundColor: colors.accent },
  assistantBubble: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.surfaceMuted,
    borderLeftWidth: 5,
    borderLeftColor: colors.teal,
  },
  text: { color: colors.text, fontSize: 16, lineHeight: 24, fontFamily: fonts.serif },
  userText: { color: "#fff", fontFamily: fonts.sans },
  sources: { marginTop: 10 },
  sourcesLabel: {
    color: colors.teal,
    fontSize: 12,
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    fontWeight: "700",
  },
  });
}
