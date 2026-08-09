import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
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
import * as DocumentPicker from "expo-document-picker";
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from "expo-speech-recognition";
import { ingest, ingestFiles, ingestUrls, type PickedFile } from "../../lib/api";
import { GROUPS, DEFAULT_GROUP, parseTags } from "../../lib/constants";
import { useEntries } from "../../stores/entryStore";
import { useTheme } from "../theme-context";
import { fonts } from "../../theme";

// Files we can extract text from today. The backend decides what it can read;
// this just hints the OS picker. Add new types here as the backend grows.
const ACCEPTED_TYPES = [
  "text/plain",
  "text/markdown",
  "text/html",
  "application/pdf",
  "application/octet-stream", // some .md / .txt report this
];

// Pull link-looking tokens out of free text (newline / space / comma separated),
// de-duplicated. The backend normalizes and validates each one further.
function parseUrls(text: string): string[] {
  const tokens = text
    .split(/[\s,]+/)
    .map((t) => t.trim())
    .filter((t) => /^(https?:\/\/)?[\w-]+(\.[\w-]+)+(\/.*)?$/i.test(t));
  return Array.from(new Set(tokens));
}

function normalizeAssets(result: any): PickedFile[] {
  if (!result || result.canceled) return [];
  const assets = Array.isArray(result.assets)
    ? result.assets
    : Array.isArray(result.output)
      ? result.output
      : [];
  return assets
    .filter((a: any) => a?.uri && a?.name)
    .map((a: any) => ({ uri: a.uri, name: a.name, mimeType: a.mimeType }));
}

function fileIcon(name: string): string {
  const ext = name.split(".").pop()?.toLowerCase();
  if (ext === "pdf") return "📕";
  if (ext === "html" || ext === "htm") return "🌐";
  return "📄";
}

function appendVoiceText(previous: string, next: string): string {
  const cleaned = next.trim();
  if (!cleaned) return previous;

  const trimmedPrevious = previous.trim();
  if (!trimmedPrevious) return cleaned;

  const needsSeparator = trimmedPrevious && !/[\s]$/.test(trimmedPrevious);
  return needsSeparator ? `${trimmedPrevious} ${cleaned}` : `${trimmedPrevious}${cleaned}`;
}

export default function Capture() {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [group, setGroup] = useState<string>(DEFAULT_GROUP);
  const [tagsInput, setTagsInput] = useState("");
  const [linksInput, setLinksInput] = useState("");
  const [attachments, setAttachments] = useState<PickedFile[]>([]);
  const [busy, setBusy] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [voiceDraft, setVoiceDraft] = useState("");
  const [voiceTranscript, setVoiceTranscript] = useState("");
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [showLinkInput, setShowLinkInput] = useState(false);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const contentSnapshot = useRef("");
  const voiceTranscriptRef = useRef("");
  const reloadEntries = useEntries((s) => s.load);

  const links = parseUrls(linksInput);
  const noteReady = content.trim().length > 0;
  const canSubmit = noteReady || links.length > 0 || attachments.length > 0;

  const queued = [
    noteReady ? "1 note" : null,
    links.length ? `${links.length} link${links.length === 1 ? "" : "s"}` : null,
    attachments.length ? `${attachments.length} file${attachments.length === 1 ? "" : "s"}` : null,
  ].filter(Boolean);

  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

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

  useSpeechRecognitionEvent("start", () => setIsListening(true));
  useSpeechRecognitionEvent("end", () => setIsListening(false));
  useSpeechRecognitionEvent("result", (event: any) => {
    const transcript = event?.results?.[0]?.transcript?.trim();
    if (!transcript) return;

    if (event?.isFinal) {
      const prev = voiceTranscriptRef.current?.trim() || "";
      const next = prev.endsWith(transcript) ? prev : prev ? `${prev} ${transcript}` : transcript;
      voiceTranscriptRef.current = next;
      setVoiceTranscript(next);
      setVoiceDraft("");
      setContent(appendVoiceText(contentSnapshot.current, next));
    } else {
      setVoiceDraft(transcript);
      const base = appendVoiceText(contentSnapshot.current, voiceTranscriptRef.current);
      setContent(appendVoiceText(base, transcript));
    }
  });
  useSpeechRecognitionEvent("error", (event: any) => {
    setContent(contentSnapshot.current);
    setIsListening(false);
    setVoiceDraft("");
    setVoiceTranscript("");
    voiceTranscriptRef.current = "";
    const message = event?.message || "Voice input could not be completed.";
    Alert.alert("Voice input unavailable", message);
  });

  const pickFiles = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: ACCEPTED_TYPES,
      multiple: true,
      copyToCacheDirectory: true,
    });
    const picked = normalizeAssets(result);
    if (!picked.length) return;
    setAttachments((prev) => {
      const seen = new Set(prev.map((p) => p.uri));
      return [...prev, ...picked.filter((p) => !seen.has(p.uri))];
    });
  };

  const removeAttachment = (uri: string) =>
    setAttachments((prev) => prev.filter((p) => p.uri !== uri));

  const startVoiceInput = async () => {
    if (busy || isListening) return;

    const permissionResult = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!permissionResult.granted) {
      Alert.alert(
        "Microphone access needed",
        "Please allow microphone access so you can dictate into your note.",
      );
      return;
    }

    contentSnapshot.current = content;
    voiceTranscriptRef.current = "";
    setVoiceDraft("");
    setVoiceTranscript("");
    ExpoSpeechRecognitionModule.start({
      lang: "en-US",
      interimResults: true,
      continuous: true,
    });
  };

  const stopVoiceInput = () => {
    if (isListening) {
      ExpoSpeechRecognitionModule.stop();
    }
  };

  const acceptVoiceCandidate = () => {
    // content already has the live transcript — just clean up voice state
    setVoiceDraft("");
    setVoiceTranscript("");
    voiceTranscriptRef.current = "";
    setIsListening(false);
    if (isListening) ExpoSpeechRecognitionModule.stop();
  };

  const discardVoiceCandidate = () => {
    setContent(contentSnapshot.current); // roll back to pre-dictation text
    setVoiceDraft("");
    setVoiceTranscript("");
    voiceTranscriptRef.current = "";
    setIsListening(false);
    if (isListening) ExpoSpeechRecognitionModule.stop();
  };

  const submit = async () => {
    if (!canSubmit || busy) return;
    setBusy(true);
    const tags = parseTags(tagsInput);
    const added: string[] = [];
    const skipped: string[] = [];
    try {
      if (noteReady) {
        await ingest({ title: title.trim() || undefined, content: content.trim(), group, tags });
        added.push("note saved");
      }
      if (attachments.length) {
        const r = await ingestFiles({ assets: attachments, group, tags });
        added.push(`${r.succeeded}/${attachments.length} file${attachments.length === 1 ? "" : "s"}`);
        skipped.push(
          ...r.results.filter((x) => !x.ok).map((x) => `• ${x.filename}${x.error ? ` — ${x.error}` : ""}`),
        );
      }
      if (links.length) {
        const r = await ingestUrls({ urls: links, group, tags });
        added.push(`${r.succeeded}/${links.length} link${links.length === 1 ? "" : "s"}`);
        skipped.push(
          ...r.results.filter((x) => !x.ok).map((x) => `• ${x.url}${x.error ? ` — ${x.error}` : ""}`),
        );
      }

      reloadEntries();
      setTitle("");
      setContent("");
      setTagsInput("");
      setLinksInput("");
      setAttachments([]);

      const detail =
        (added.join(" · ") || "Nothing added") +
        (skipped.length ? `\n\nSkipped:\n${skipped.join("\n")}` : "");
      Alert.alert("Added to your knowledge base", detail);
    } catch (e) {
      Alert.alert("Couldn't add", (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={90}
    >
      {/* ── Everything lives in the bottom compose area ── */}
      <View style={styles.composeWrap}>
       

        {/* Attach menu popup */}
        {showAttachMenu && (
          <View style={styles.attachMenu}>
            <TouchableOpacity
              style={styles.attachMenuItem}
              onPress={() => { setShowAttachMenu(false); pickFiles(); }}
            >
              <Feather name="file-text" size={16} color={colors.accent} />
              <Text style={styles.attachMenuText}>File (txt, pdf, html)</Text>
            </TouchableOpacity>
            <View style={styles.attachMenuDivider} />
            <TouchableOpacity
              style={styles.attachMenuItem}
              onPress={() => { setShowAttachMenu(false); setShowLinkInput(true); }}
            >
              <Feather name="link" size={16} color={colors.accent} />
              <Text style={styles.attachMenuText}>Web link</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Link input row */}
        {showLinkInput && (
          <View style={styles.linkInputRow}>
            <Feather name="link" size={14} color={colors.accent} />
            <TextInput
              style={styles.linkInput}
              placeholder="Paste a URL…"
              placeholderTextColor={colors.muted}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              value={linksInput}
              onChangeText={setLinksInput}
              autoFocus
            />
            <TouchableOpacity onPress={() => setShowLinkInput(false)} hitSlop={8}>
              <Feather name="check" size={16} color={colors.accent} />
            </TouchableOpacity>
          </View>
        )}

        {/* Listening indicator */}
        {isListening && (
          <View style={styles.voiceStrip}>
            <View style={styles.voiceListeningDot} />
            <Text style={styles.voiceStripText}>Listening…</Text>
          </View>
        )}

        {/* Compose bar */}
        <View style={styles.composeBar}>
          {/* Left: always the + button */}
          <TouchableOpacity
            style={styles.attachBtn}
            onPress={() => { setShowAttachMenu((v) => !v); setShowLinkInput(false); }}
            disabled={busy || isListening}
          >
            <Feather name={showAttachMenu ? "x" : "plus"} size={20} color={isListening ? colors.muted : colors.accent} />
          </TouchableOpacity>

          {/* Text input — shows live dictation in real time */}
          <TextInput
            style={styles.composeInput}
            placeholder={isListening ? "Listening…" : "Type your wisdom…"}
            placeholderTextColor={isListening ? colors.accent : colors.muted}
            multiline
            scrollEnabled={false}
            value={content}
            onChangeText={setContent}
          />

          {/* Right: check/cancel while listening, otherwise mic + send */}
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
              <TouchableOpacity style={styles.micBtn} onPress={startVoiceInput} disabled={busy}>
                <Feather name="mic" size={18} color={colors.accent} />
              </TouchableOpacity>
              {canSubmit && (
                <TouchableOpacity style={styles.sendBtn} onPress={submit} disabled={busy}>
                  {busy ? (
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
    </KeyboardAvoidingView>
  );
}

function createStyles(colors: typeof import("../../theme").colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },

    /* Scrollable area */
    scroll: { flex: 1 },
    scrollContent: { padding: 16, paddingBottom: 12 },

    /* Collection chips */
    chipRow: { gap: 8, paddingBottom: 14, paddingRight: 8 },
    chip: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.surfaceMuted,
      backgroundColor: colors.surface,
    },
    chipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
    chipText: { color: colors.muted, fontWeight: "700", fontSize: 13 },
    chipTextActive: { color: "#fff" },

    /* Main card */
    mainCard: {
      backgroundColor: colors.surface,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.surfaceMuted,
      paddingHorizontal: 16,
      marginBottom: 12,
      shadowColor: colors.text,
      shadowOpacity: 0.06,
      shadowOffset: { width: 0, height: 8 },
      shadowRadius: 16,
      elevation: 3,
    },
    titleInput: {
      fontSize: 18,
      fontWeight: "700",
      color: colors.text,
      paddingVertical: 14,
    },
    divider: { height: 1, backgroundColor: colors.surfaceMuted },
    bodyInput: {
      minHeight: 120,
      fontSize: 16,
      lineHeight: 24,
      color: colors.text,
      fontFamily: fonts.serif,
      paddingVertical: 14,
      textAlignVertical: "top",
    },

    /* Attachment / link chips list */
    attachList: { gap: 8, marginBottom: 10 },
    fileChip: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      backgroundColor: colors.surface,
      borderColor: colors.surfaceMuted,
      borderWidth: 1,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    fileChipText: { flex: 1, color: colors.text, fontSize: 13, marginRight: 8 },
    linkChip: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.accentSoft,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    linkChipText: { flex: 1, color: colors.accent, fontSize: 13 },

    /* Tags */
    tagsInput: {
      fontSize: 14,
      color: colors.text,
      paddingVertical: 10,
      paddingHorizontal: 4,
    },

    /* ── Bottom compose area (fills the whole screen) ── */
    composeWrap: {
      flex: 1,
      justifyContent: "flex-end",
      borderTopWidth: 1,
      borderTopColor: colors.surfaceMuted,
      backgroundColor: colors.surface,
      paddingBottom: Platform.OS === "ios" ? 24 : 12,
    },


    /* Attach popup */
    attachMenu: {
      marginHorizontal: 12,
      marginTop: 10,
      backgroundColor: colors.bg,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.surfaceMuted,
      overflow: "hidden",
    },
    attachMenuItem: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingHorizontal: 16,
      paddingVertical: 13,
    },
    attachMenuText: { color: colors.text, fontSize: 14, fontWeight: "600" },
    attachMenuDivider: { height: 1, backgroundColor: colors.surfaceMuted },

    /* Link input row */
    linkInputRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginHorizontal: 12,
      marginTop: 10,
      backgroundColor: colors.bg,
      borderWidth: 1,
      borderColor: colors.accent,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    linkInput: { flex: 1, fontSize: 14, color: colors.text },

    /* Voice strip */
    voiceStrip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginHorizontal: 12,
      marginTop: 10,
      paddingHorizontal: 12,
      paddingVertical: 8,
      backgroundColor: colors.accentSoft,
      borderRadius: 10,
    },
    voiceListeningDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: colors.accent,
    },
    voiceStripText: { flex: 1, color: colors.accent, fontSize: 13, fontWeight: "600" },

    /* Compose bar */
    composeBar: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingHorizontal: 12,
      paddingTop: 10,
    },
    attachBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      borderWidth: 1.5,
      borderColor: colors.accent,
      borderStyle: "dashed",
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
      maxHeight: 100,
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

    /* Voice accept/cancel */
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

    /* Queued summary */
    queued: {
      textAlign: "center",
      color: colors.muted,
      fontSize: 12,
      paddingTop: 6,
    },
  });
}
