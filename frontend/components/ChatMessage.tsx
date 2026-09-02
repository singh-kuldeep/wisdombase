import { useMemo, useState } from "react";
import { AccessibilityInfo, Platform, Share, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Feather } from "@expo/vector-icons";
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
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (Platform.OS === "web" && typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(message.content);
    } else {
      await Share.share({ message: message.content });
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  };

  const handleReadAloud = () => {
    if (Platform.OS === "web" && typeof window !== "undefined" && "speechSynthesis" in window) {
      if (isSpeaking) {
        window.speechSynthesis.cancel();
        setIsSpeaking(false);
        return;
      }

      const normalizeForSpeech = (text: string) =>
        text
          .replace(/\u2022/g, " ")
          .replace(/\n{2,}/g, ". ")
          .replace(/\n/g, ", ")
          .replace(/\s{2,}/g, " ")
          .trim();

      const pickVoice = () => {
        const voices = window.speechSynthesis.getVoices();
        if (!voices.length) return undefined;

        const preferredNames = [
          "Google US English",
          "Samantha",
          "Microsoft Aria Online (Natural)",
          "Microsoft Jenny Online (Natural)",
          "Ava (Enhanced)",
          "Moira",
          "Karen",
          "Daniel",
        ];

        const exact = voices.find((v) => preferredNames.includes(v.name));
        if (exact) return exact;

        const score = (v: SpeechSynthesisVoice) => {
          const name = (v.name || "").toLowerCase();
          const lang = (v.lang || "").toLowerCase();
          let s = 0;
          if (lang.startsWith("en-us")) s += 50;
          else if (lang.startsWith("en-gb")) s += 40;
          else if (lang.startsWith("en")) s += 25;
          if (/natural|enhanced|neural|premium/.test(name)) s += 40;
          if (/aria|jenny|samantha|google us english|ava|moira|karen/.test(name)) s += 35;
          if (!v.localService) s += 8;
          if (v.default) s += 6;
          return s;
        };

        return [...voices].sort((a, b) => score(b) - score(a))[0];
      };

      const speakNow = () => {
        const utterance = new SpeechSynthesisUtterance(normalizeForSpeech(message.content));
        const voice = pickVoice();
        utterance.voice = voice ?? null;
        utterance.lang = voice?.lang || "en-US";
        utterance.rate = 0.96;
        utterance.pitch = 1.0;
        utterance.volume = 1;
        utterance.onend = () => setIsSpeaking(false);
        utterance.onerror = () => setIsSpeaking(false);
        setIsSpeaking(true);
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(utterance);
      };

      if (window.speechSynthesis.getVoices().length === 0) {
        const onVoicesLoaded = () => {
          window.speechSynthesis.removeEventListener("voiceschanged", onVoicesLoaded);
          speakNow();
        };
        window.speechSynthesis.addEventListener("voiceschanged", onVoicesLoaded);
        setTimeout(() => {
          window.speechSynthesis.removeEventListener("voiceschanged", onVoicesLoaded);
          if (!isSpeaking) speakNow();
        }, 700);
      } else {
        speakNow();
      }
      return;
    }

    setIsSpeaking(true);
    AccessibilityInfo.announceForAccessibility(message.content);
    setTimeout(() => setIsSpeaking(false), 900);
  };

  return (
    <View style={[styles.wrap, isUser ? styles.userWrap : styles.assistantWrap]}>
      <View style={[styles.bubble, isUser ? styles.userBubble : styles.assistantBubble]}>
        <Text style={[styles.text, isUser && styles.userText]}>{message.content}</Text>
      </View>
      {!isUser && (
        <View style={styles.actionsRow}>
          <TouchableOpacity style={styles.actionBtn} onPress={handleCopy} activeOpacity={0.75}>
            <Feather name={copied ? "check" : "copy"} size={15} color={copied ? colors.teal : colors.muted} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} onPress={handleReadAloud} activeOpacity={0.75}>
            <Feather name={isSpeaking ? "square" : "volume-2"} size={15} color={isSpeaking ? colors.accent : colors.muted} />
          </TouchableOpacity>
        </View>
      )}
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
    paddingVertical: 10,
    paddingHorizontal: 12,
    shadowColor: colors.bg,
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 12 },
    shadowRadius: 18,
    elevation: 3,
  },
  userBubble: { backgroundColor: colors.accent },
  assistantBubble: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderLeftWidth: 3,
    borderLeftColor: colors.teal,
  },
  text: { color: colors.text, fontSize: 14, lineHeight: 20, fontFamily: fonts.serif },
  userText: { color: "#fff", fontFamily: fonts.sans },
  actionsRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 8,
    marginLeft: 4,
  },
  actionBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  sources: { marginTop: 10 },
  sourcesLabel: {
    color: colors.teal,
    fontSize: 12,
    marginBottom: 0,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    fontWeight: "700",
  },
  });
}
