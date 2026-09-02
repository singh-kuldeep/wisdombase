import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from "expo-speech-recognition";
import { useLocalSearchParams } from "expo-router";
import { useIsFocused } from "@react-navigation/native";
import { query, getUsage, type Source, type Usage } from "../../lib/api";
import { STARTER_QUESTIONS } from "../../lib/constants";
import { getProviderKeys } from "../../lib/secureStore";
import ChatMessage, { type Message } from "../../components/ChatMessage";
import LoadingDots from "../../components/LoadingDots";
import { useEntries } from "../../stores/entryStore";
import { useTheme } from "../theme-context";
import { fonts } from "../../theme";
import { formatDateLabel } from "../utils/dateUtils";

export default function Ask() {
  const isFocused = useIsFocused();
  const { autoListen } = useLocalSearchParams<{ autoListen?: string }>();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [selectedSource, setSelectedSource] = useState<Source | null>(null);
  const [usage, setUsage] = useState<Usage | null>(null);
  const [hasOwnKey, setHasOwnKey] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [inputHeight, setInputHeight] = useState(40);
  const listRef = useRef<FlatList>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const inputSnapshot = useRef("");
  const voiceTranscriptRef = useRef("");
  const voiceOwnedByAskRef = useRef(false);
  const { entries, loading: entriesLoading, load } = useEntries();

  useEffect(() => {
    load();
  }, []);

  // Free-tier status: users without their own key get a limited number of
  // questions on the shared backend key. Skip the lookup once we know they
  // have their own key (they're unlimited).
  useEffect(() => {
    (async () => {
      try {
        const keys = await getProviderKeys();
        const own = keys.some((k) => (k.apiKey || "").trim());
        setHasOwnKey(own);
        if (!own) setUsage(await getUsage());
      } catch {
        // Non-blocking: the Ask flow still works without the usage banner.
      }
    })();
  }, []);

  const startNewAsk = useCallback(() => {
    if (voiceOwnedByAskRef.current || isListening) {
      ExpoSpeechRecognitionModule.stop();
    }
    if (Platform.OS === "web" && typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    voiceOwnedByAskRef.current = false;
    voiceTranscriptRef.current = "";
    setIsListening(false);
    setMessages([]);
    setInput("");
    setInputHeight(40);
    setLoading(false);
    setSelectedSource(null);
  }, [isListening]);

  useEffect(() => {
    if (!isListening) {
      pulseAnim.stopAnimation();
      pulseAnim.setValue(1);
      return;
    }
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.05, duration: 600, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 0.95, duration: 600, useNativeDriver: true }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [isListening, pulseAnim]);

  useSpeechRecognitionEvent("start", () => {
    if (!isFocused || !voiceOwnedByAskRef.current) return;
    setIsListening(true);
  });
  useSpeechRecognitionEvent("end", () => {
    if (!voiceOwnedByAskRef.current) return;
    setIsListening(false);
    voiceOwnedByAskRef.current = false;
  });
  useSpeechRecognitionEvent("result", (event: any) => {
    if (!isFocused || !voiceOwnedByAskRef.current) return;
    const transcript = event?.results?.[0]?.transcript?.trim();
    if (!transcript) return;
    if (event?.isFinal) {
      const prev = voiceTranscriptRef.current?.trim() || "";
      const next = prev.endsWith(transcript) ? prev : prev ? `${prev} ${transcript}` : transcript;
      voiceTranscriptRef.current = next;
      setInput(inputSnapshot.current ? `${inputSnapshot.current} ${next}` : next);
    } else {
      const base = inputSnapshot.current ? `${inputSnapshot.current} ${voiceTranscriptRef.current}` : voiceTranscriptRef.current;
      setInput(base ? `${base} ${transcript}` : transcript);
    }
  });
  useSpeechRecognitionEvent("error", () => {
    if (!voiceOwnedByAskRef.current) return;
    setInput(inputSnapshot.current);
    setIsListening(false);
    voiceTranscriptRef.current = "";
    voiceOwnedByAskRef.current = false;
  });

  const startVoiceInput = async () => {
    if (loading || isListening) return;
    const permissionResult = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!permissionResult.granted) return;
    voiceOwnedByAskRef.current = true;
    inputSnapshot.current = input;
    voiceTranscriptRef.current = "";
    ExpoSpeechRecognitionModule.start({ lang: "en-US", interimResults: true, continuous: true });
  };

  useEffect(() => {
    if (autoListen !== "1") return;
    if (!isFocused) return;
    if (loading || isListening) return;
    startVoiceInput();
    // Intentionally run only on route param changes to avoid restarting while listening.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoListen, isFocused]);

  useEffect(() => {
    if (isFocused) return;
    if (voiceOwnedByAskRef.current || isListening) {
      ExpoSpeechRecognitionModule.stop();
      voiceOwnedByAskRef.current = false;
      setIsListening(false);
      voiceTranscriptRef.current = "";
    }
  }, [isFocused, isListening]);

  const acceptVoiceCandidate = () => {
    voiceTranscriptRef.current = "";
    setIsListening(false);
    voiceOwnedByAskRef.current = false;
    if (isListening) ExpoSpeechRecognitionModule.stop();
  };

  const discardVoiceCandidate = () => {
    setInput(inputSnapshot.current);
    voiceTranscriptRef.current = "";
    setIsListening(false);
    voiceOwnedByAskRef.current = false;
    if (isListening) ExpoSpeechRecognitionModule.stop();
  };

  const send = async (override?: string) => {
    const question = (override ?? input).trim();
    if (!question || loading) return;

    const history = messages.map((m) => ({ role: m.role, content: m.content }));
    const next = [...messages, { role: "user" as const, content: question }];
    setMessages(next);
    if (Platform.OS === "web" && typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    setInput("");
    setLoading(true);

    try {
      const providers = await getProviderKeys();
      // Also pass the top Anthropic key as legacy api_key so an older backend
      // (not yet redeployed with multi-provider support) keeps working.
      const api_key = providers.find((p) => p.provider === "anthropic")?.apiKey ?? null;
      const { answer, sources, usage: newUsage } = await query({ question, providers, api_key, history });
      setMessages((m) => [...m, { role: "assistant", content: answer, sources }]);
      if (newUsage) {
        setUsage(newUsage);
        setHasOwnKey(!!newUsage.has_own_key);
      }
    } catch (e) {
      setMessages((m) => [
        ...m,
        { role: "assistant", content: `⚠️ ${(e as Error).message}` },
      ]);
    } finally {
      setLoading(false);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    }
  };

  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const selectedEntry = selectedSource ? entries.find((entry) => entry.id === selectedSource.entry_id) : null;
  const sourceDetailTitle = selectedEntry?.title || selectedSource?.title || "Source detail";
  const sourceDetailDate = selectedEntry?.created_at.slice(0, 10) || selectedSource?.date;
  const sourceDetailContent = selectedEntry?.content || selectedSource?.snippet || "No detail available.";

  const handleSourcePress = (source: Source) => {
    setSelectedSource(source);
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={90}
    >
      {selectedSource ? (
        <View style={styles.detailContainer}>
          <View style={styles.detailHeader}>
            <TouchableOpacity style={styles.backButton} onPress={() => setSelectedSource(null)}>
              <Text style={styles.backText}>← Back</Text>
            </TouchableOpacity>
            {/* <Text style={styles.detailTitle}>Source detail</Text> */}
          </View>

          <ScrollView style={styles.detailScroll} contentContainerStyle={styles.detailContent}>
            <Text style={styles.detailEntryTitle} numberOfLines={2}>
              {sourceDetailTitle}
            </Text>
            {!!sourceDetailDate && <Text style={styles.detailEntryDate}>{formatDateLabel(sourceDetailDate)}</Text>}
            <Text style={styles.detailEntryBody}>{sourceDetailContent}</Text>
            {selectedEntry?.source ? (
              <Text style={styles.detailEntrySource}>Source: {selectedEntry.source}</Text>
            ) : null}
            {entriesLoading ? (
              <Text style={styles.detailLoading}>Loading knowledge base…</Text>
            ) : null}
          </ScrollView>
        </View>
      ) : messages.length === 0 && !loading ? (
        <ScrollView contentContainerStyle={styles.empty}>
          {/* <View style={styles.heroBanner}>
            <Text style={styles.heroTitle}>Ask your thinking, not the internet.</Text>
            <Text style={styles.heroSubtitle}>
              Grow smarter answers from your own notes and reflections. Get focused replies that feel like your own memory.
            </Text>
          </View> */}
          <Text style={styles.emptyTitle}>Ask your own wisdom</Text>
          <Text style={styles.emptyBody}>
            Tap a question to start — these draw on built-in wisdom, so you can ask
            before adding anything of your own.
          </Text>
          {!hasOwnKey && usage ? (
            usage.free_remaining > 0 ? (
              <Text style={styles.freeNote}>
                ✦ {usage.free_remaining} of {usage.free_limit} free questions left
              </Text>
            ) : (
              <Text style={styles.freeNoteWarn}>
                You've used all {usage.free_limit} free questions. Add your own API
                key in Settings to keep asking.
              </Text>
            )
          ) : null}
          <View style={styles.suggestions}>
            {STARTER_QUESTIONS.map((q) => (
              <TouchableOpacity key={q} style={styles.suggestion} onPress={() => send(q)}>
                <Text style={styles.suggestionText}>{q}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      ) : (
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(_, i) => String(i)}
          renderItem={({ item }) => <ChatMessage message={item} onSourcePress={handleSourcePress} />}
          contentContainerStyle={styles.list}
          ListFooterComponent={loading ? <LoadingDots /> : null}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
        />
      )}
      {selectedSource ? null : (
        <View style={styles.bar}>
        <View style={styles.composeRow}>
          {messages.length > 0 ? (
            <TouchableOpacity
              style={styles.composeNewAskBtn}
              onPress={startNewAsk}
              activeOpacity={0.8}
              accessibilityLabel="Start a new ask"
            >
              <Feather name="plus" size={18} color={colors.accent} />
            </TouchableOpacity>
          ) : null}

          <TextInput
            style={[styles.composeInput, { height: Math.max(40, inputHeight) }]}
            placeholder={isListening ? "Listening…" : "Ask your wisdom..."}
            placeholderTextColor={isListening ? colors.accent : colors.muted}
            value={input}
            onChangeText={setInput}
            multiline
            scrollEnabled={false}
            textAlignVertical="top"
            onKeyPress={(e) => {
              if (e.nativeEvent.key === "Enter") {
                e.preventDefault();
                send();
              }
            }}
            onContentSizeChange={(e) => setInputHeight(e.nativeEvent.contentSize.height)}
            onSubmitEditing={() => send()}
          />

          {isListening ? (
            <Animated.View style={[styles.voiceActions, { transform: [{ scale: pulseAnim }] }]}>
              <TouchableOpacity style={styles.voiceActionAccept} onPress={acceptVoiceCandidate}>
                <Feather name="check" size={16} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.voiceActionDecline} onPress={discardVoiceCandidate}>
                <Feather name="x" size={16} color={colors.text} />
              </TouchableOpacity>
            </Animated.View>
          ) : (
            <View style={styles.voiceActions}>
              <TouchableOpacity style={styles.micBtn} onPress={startVoiceInput} disabled={loading}>
                <Feather name="mic" size={18} color={colors.accent} />
              </TouchableOpacity>
              {!!input.trim() && (
                <TouchableOpacity
                  style={[styles.sendBtn, loading && styles.disabled]}
                  onPress={() => send()}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Feather name="send" size={16} color="#fff" />
                  )}
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>
      </View>
      )}
      
    </KeyboardAvoidingView>
  );
}

function createStyles(colors: typeof import("../../theme").colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    list: { padding: 16 },
    empty: { flexGrow: 1, justifyContent: "center", alignItems: "center", padding: 28 },
    heroBanner: {
      marginBottom: 24,
      backgroundColor: colors.surface,
      borderRadius: 24,
      padding: 22,
      borderWidth: 1,
      borderColor: colors.surfaceMuted,
      shadowColor: colors.text,
      shadowOpacity: 0.08,
      shadowOffset: { width: 0, height: 14 },
      shadowRadius: 24,
      elevation: 5,
    },
    heroTitle: { fontSize: 22, fontWeight: "800", color: colors.text, lineHeight: 30, marginBottom: 8, textAlign: "center" },
    heroSubtitle: { fontSize: 15, color: colors.muted, lineHeight: 22, textAlign: "center" },
    emptyTitle: { fontSize: 22, fontFamily: fonts.serif, color: colors.text, marginBottom: 12, textAlign: "center" },
    emptyBody: { fontSize: 15, color: colors.muted, textAlign: "center", lineHeight: 22, marginBottom: 18 },
    freeNote: { marginTop: 14, fontSize: 13, fontWeight: "700", color: colors.teal, textAlign: "center" },
    freeNoteWarn: { marginTop: 14, fontSize: 13, color: colors.danger, textAlign: "center", lineHeight: 19 },
    suggestions: { marginTop: 22, alignSelf: "stretch", gap: 12 },
    suggestion: {
      backgroundColor: colors.surface,
      borderColor: colors.surfaceMuted,
      borderWidth: 1,
      borderRadius: 16,
      paddingVertical: 10,
      paddingHorizontal: 12,
      shadowColor: colors.text,
      shadowOpacity: 0.06,
      shadowOffset: { width: 0, height: 10 },
      shadowRadius: 18,
      elevation: 3,
    },
    suggestionText: { color: colors.text, fontSize: 15, lineHeight: 22 },
    bar: {
      flexDirection: "column",
      gap: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderTopColor: colors.surfaceMuted,
      borderTopWidth: 1,
      backgroundColor: colors.surface,
      paddingBottom: Platform.OS === "ios" ? 24 : 12,
    },
    newAskButton: {
      alignSelf: "flex-start",
      height: 36,
      paddingHorizontal: 14,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: colors.accent,
      backgroundColor: colors.accentSoft,
      alignItems: "center",
      justifyContent: "center",
    },
    newAskText: { color: colors.accent, fontWeight: "700", fontSize: 13 },
    composeRow: {
      flexDirection: "row",
      alignItems: "flex-end",
      gap: 8,
    },
    composeNewAskBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.accent,
      backgroundColor: colors.accentSoft,
      alignItems: "center",
      justifyContent: "center",
    },
    composeInput: {
      flex: 1,
      backgroundColor: colors.bg,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.surfaceMuted,
      paddingHorizontal: 14,
      paddingVertical: 10,
      fontSize: 15,
      color: colors.text,
    },
    micBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.accentSoft,
      alignItems: "center",
      justifyContent: "center",
    },
    sendBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.accent,
      alignItems: "center",
      justifyContent: "center",
    },
    voiceActions: { flexDirection: "row", gap: 6 },
    voiceActionAccept: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.accent,
      alignItems: "center",
      justifyContent: "center",
    },
    voiceActionDecline: {
      width: 40,
      height: 40,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.surfaceMuted,
      backgroundColor: colors.surface,
      alignItems: "center",
      justifyContent: "center",
    },
    disabled: { opacity: 0.4 },
    detailContainer: { flex: 1, backgroundColor: colors.bg },
    detailHeader: {
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceMuted,
    backgroundColor: colors.surface,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  backButton: { marginRight: 12, paddingVertical: 6, paddingHorizontal: 10 },
  backText: { color: colors.accent, fontWeight: "700", fontSize: 16 },
  detailTitle: { fontSize: 18, fontWeight: "700", color: colors.text },
  detailScroll: { flex: 1, backgroundColor: colors.bg },
  detailContent: { padding: 18 },
  detailEntryTitle: { fontSize: 20, fontWeight: "700", color: colors.text, marginBottom: 8 },
  detailEntryDate: { fontSize: 13, color: colors.muted, marginBottom: 16 },
  detailEntryBody: { fontSize: 16, color: colors.text, lineHeight: 24, fontFamily: fonts.serif, marginBottom: 18 },
  detailEntrySource: { fontSize: 13, color: colors.muted, fontStyle: "italic" },
  detailLoading: { color: colors.muted, marginTop: 14, fontSize: 14 },
  });
}
