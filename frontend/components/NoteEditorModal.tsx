import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  KeyboardAvoidingView,
  Modal,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions
} from "react-native";
import { Feather } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from "expo-speech-recognition";
import { useCustomAlert } from "./CustomAlert";
import { ingest, ingestFiles, updateEntry, type PickedFile } from "../lib/api";
import { DEFAULT_GROUP, parseTags } from "../lib/constants";
import { useEntries } from "../stores/entryStore";
import { useTheme } from "../app/theme-context";

const ACCEPTED_TYPES = [
  "text/plain",
  "text/markdown",
  "text/html",
  "application/pdf",
  "application/octet-stream",
];

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

function appendVoiceText(previous: string, next: string): string {
  const cleaned = next.trim();
  if (!cleaned) return previous;
  const trimmedPrevious = previous.trim();
  if (!trimmedPrevious) return cleaned;
  return !/[\s]$/.test(trimmedPrevious)
    ? `${trimmedPrevious} ${cleaned}`
    : `${trimmedPrevious}${cleaned}`;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  mode?: "create" | "edit";
  entryId?: string;
  initialTitle?: string;
  initialContent?: string;
  initialTags?: string[];
  initialGroup?: string | null;
  onSaved?: () => void;
}

export default function NoteEditorModal({
  visible,
  onClose,
  mode = "create",
  entryId,
  initialTitle = "",
  initialContent = "",
  initialTags = [],
  initialGroup,
  onSaved,
}: Props) {
  const isEdit = mode === "edit";
  const { showAlert } = useCustomAlert();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState(initialContent);
  const [tagsInput, setTagsInput] = useState("");
  const [attachments, setAttachments] = useState<PickedFile[]>([]);
  const [busy, setBusy] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [showTags, setShowTags] = useState(false);
  const [titleFocused, setTitleFocused] = useState(false);
  const [bodyFocused, setBodyFocused] = useState(false);

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const contentSnapshot = useRef("");
  const voiceTranscriptRef = useRef("");
  const reloadEntries = useEntries((s) => s.load);
  const { colors } = useTheme();
  const { height } = useWindowDimensions();
  const styles = useMemo(() => createStyles(colors, height), [colors, height]);

  // Reset when opened
  useEffect(() => {
    if (visible) {
      setTitle(initialTitle);
      setContent(initialContent);
      setTagsInput(initialTags.join(", "));
      setAttachments([]);
      setBusy(false);
      setTitleFocused(false);
      setBodyFocused(false);
    }
  }, [visible, initialTitle, initialContent, initialTags]);

  // Pulse animation while listening
  useEffect(() => {
    if (!isListening) {
      pulseAnim.stopAnimation();
      pulseAnim.setValue(1);
      return;
    }
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.2, duration: 500, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1.0, duration: 500, useNativeDriver: true }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [isListening]);

  useSpeechRecognitionEvent("start", () => setIsListening(true));
  useSpeechRecognitionEvent("end", () => setIsListening(false));
  useSpeechRecognitionEvent("result", (event: any) => {
    const transcript = event?.results?.[0]?.transcript?.trim();
    if (!transcript) return;
    if (event?.isFinal) {
      const prev = voiceTranscriptRef.current?.trim() || "";
      const next = prev.endsWith(transcript) ? prev : prev ? `${prev} ${transcript}` : transcript;
      voiceTranscriptRef.current = next;
      setContent(appendVoiceText(contentSnapshot.current, next));
    } else {
      const base = appendVoiceText(contentSnapshot.current, voiceTranscriptRef.current);
      setContent(appendVoiceText(base, transcript));
    }
  });
  useSpeechRecognitionEvent("error", () => {
    setContent(contentSnapshot.current);
    setIsListening(false);
    voiceTranscriptRef.current = "";
  });

  const startVoice = async () => {
    if (busy || isListening) return;
    const perm = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!perm.granted) {
      await showAlert({ title: "Microphone access needed", message: "Please allow microphone access." });
      return;
    }
    contentSnapshot.current = content;
    voiceTranscriptRef.current = "";
    ExpoSpeechRecognitionModule.start({ lang: "en-US", interimResults: true, continuous: true });
  };

  const acceptVoice = () => {
    voiceTranscriptRef.current = "";
    setIsListening(false);
    if (isListening) ExpoSpeechRecognitionModule.stop();
  };

  const discardVoice = () => {
    setContent(contentSnapshot.current);
    voiceTranscriptRef.current = "";
    setIsListening(false);
    if (isListening) ExpoSpeechRecognitionModule.stop();
  };

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

  const save = async () => {
    const trimmedContent = content.trim();
    if (!trimmedContent && !attachments.length) {
      await showAlert({ title: "Nothing to save", message: "Write something before saving." });
      return;
    }
    setBusy(true);
    const tags = parseTags(tagsInput);
    try {
      if (isEdit) {
        if (!entryId) throw new Error("Missing entry id for update.");
        await updateEntry(entryId, {
          title: title.trim() || undefined,
          content: trimmedContent,
          group: initialGroup ?? DEFAULT_GROUP,
          tags,
        });
      } else {
        if (trimmedContent) {
          await ingest({
            title: title.trim() || undefined,
            content: trimmedContent,
            group: DEFAULT_GROUP,
            tags,
          });
        }
        if (attachments.length) {
          await ingestFiles({ assets: attachments, group: DEFAULT_GROUP, tags });
        }
      }
      await reloadEntries();
      onSaved?.();
      onClose();
    } catch (e) {
      await showAlert({
        title: isEdit ? "Couldn't update" : "Couldn't save",
        message: (e as Error).message,
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.root}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          keyboardVerticalOffset={0}
        >
          {/* ── Header ── */}
          <View style={styles.header}>
            {/* Back */}
            <TouchableOpacity style={styles.headerPill} onPress={onClose}>
              <Feather name="chevron-left" size={20} color={colors.text} />
            </TouchableOpacity>

            {/* Formatting controls pill */}
            {/* <View style={styles.headerPill}>
              <Text style={styles.headerAa}>Aa</Text>
              <View style={styles.headerDividerV} />
              <Feather name="type" size={16} color={colors.muted} />
              <View style={styles.headerDividerV} />
              <TouchableOpacity onPress={() => setShowTags((v) => !v)}>
                <Feather name="tag" size={16} color={showTags ? colors.accent : colors.muted} />
              </TouchableOpacity>
            </View> */}

            {/* Save / Done */}
            <TouchableOpacity
              style={[styles.saveBtn, busy && { opacity: 0.6 }]}
              onPress={save}
              disabled={busy}
            >
              {busy ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Feather name="check" size={20} color="#fff" />
              )}
            </TouchableOpacity>
          </View>

          {/* ── Body ── */}
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
          >
            <TextInput     
              style={[styles.titleInput, titleFocused && styles.inputFocused]}
              placeholder="Title"
              placeholderTextColor={colors.muted}
              value={title}
              onChangeText={setTitle}
              autoFocus
              onFocus={() => setTitleFocused(true)}
              onBlur={() => setTitleFocused(false)}
            />
            <View style={styles.divider} />
            <TextInput
              style={[styles.bodyInput, bodyFocused && styles.inputFocused]}
              placeholder={isListening ? "Listening…" : "Start writing…"}
              placeholderTextColor={isListening ? colors.accent : colors.muted}
              multiline
              scrollEnabled={false}
              textAlignVertical="top"
              value={content}
              onChangeText={setContent}
              onFocus={() => setBodyFocused(true)}
              onBlur={() => setBodyFocused(false)}
            />

            {/* Tags row */}
            {showTags && (
              <TextInput
                style={styles.tagsInput}
                placeholder="Tags, comma separated…"
                placeholderTextColor={colors.muted}
                autoCapitalize="none"
                value={tagsInput}
                onChangeText={setTagsInput}
              />
            )}

            {/* Attached file chips */}
            {attachments.map((a) => (
              <View key={a.uri} style={styles.fileChip}>
                <Feather name="file-text" size={13} color={colors.muted} style={{ marginRight: 6 }} />
                <Text style={styles.fileChipText} numberOfLines={1}>{a.name}</Text>
                <TouchableOpacity
                  onPress={() => setAttachments((prev) => prev.filter((p) => p.uri !== a.uri))}
                  hitSlop={10}
                >
                  <Feather name="x" size={13} color={colors.muted} />
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>

          {/* ── Bottom toolbar ── */}
          <View style={styles.toolbar}>
            {!isEdit && (
              <>
                {/* Attach files */}
                <TouchableOpacity style={styles.toolbarBtn} onPress={pickFiles} disabled={busy}>
                  <Feather name="image" size={22} color={colors.muted} />
                </TouchableOpacity>

                <TouchableOpacity style={styles.toolbarBtn} onPress={pickFiles} disabled={busy}>
                  <Feather name="paperclip" size={22} color={colors.muted} />
                </TouchableOpacity>
              </>
            )}

            {/* Voice */}
            {isListening ? (
              <>
                <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
                  <TouchableOpacity style={styles.toolbarBtn} onPress={acceptVoice}>
                    <Feather name="check-circle" size={22} color={colors.accent} />
                  </TouchableOpacity>
                </Animated.View>
                <TouchableOpacity style={styles.toolbarBtn} onPress={discardVoice}>
                  <Feather name="x-circle" size={22} color={colors.danger} />
                </TouchableOpacity>
              </>
            ) : (
              <TouchableOpacity style={styles.toolbarBtn} onPress={startVoice} disabled={busy}>
                <Feather name="mic" size={22} color={colors.muted} />
              </TouchableOpacity>
            )}

            <View style={{ flex: 1 }} />

            {/* Save shortcut */}
            <TouchableOpacity
              style={[styles.toolbarSendBtn, (!content.trim() && !attachments.length) && { opacity: 0.4 }]}
              onPress={save}
              disabled={busy || (!content.trim() && !attachments.length)}
            >
              {busy ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Feather name="arrow-up" size={18} color="#fff" />
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

function createStyles(colors: typeof import("../theme").colors, height: number) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.bg },

    /* Header */
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 16,
      paddingVertical: 10,
      gap: 10,
    },
    headerPill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      backgroundColor: colors.surface,
      borderRadius: 24,
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderWidth: 1,
      borderColor: colors.surfaceMuted,
    },
    headerAa: {
      fontSize: 15,
      fontWeight: "700",
      color: colors.text,
    },
    headerDividerV: {
      width: 1,
      height: 16,
      backgroundColor: colors.surfaceMuted,
    },
    saveBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.accent,
      alignItems: "center",
      justifyContent: "center",
    },

    /* Scroll body */
    scroll: { flex: 1 },
    scrollContent: { paddingHorizontal: 20, paddingBottom: 24 },

    titleInput: {
      fontSize: 24,
      fontWeight: "700",
      color: colors.text,
      paddingVertical: 16,
      outlineWidth: 0,
      outlineColor: "transparent",
      ...(Platform.OS === "web" ? ({ outlineStyle: "none", boxShadow: "none" } as any) : null),
    },
    inputFocused: {
      outlineWidth: 0,
      outlineColor: "transparent",
      ...(Platform.OS === "web" ? ({ outlineStyle: "none", boxShadow: "none" } as any) : null),
    },
    divider: {
      height: 1,
      backgroundColor: colors.surfaceMuted,
      marginBottom: 12,
    },
    bodyInput: {
      fontSize: 17,
      lineHeight: 26,
      color: colors.text,
      minHeight: height - 225,
      textAlignVertical: "top",
      outlineWidth: 0,
      outlineColor: "transparent",
      ...(Platform.OS === "web" ? ({ outlineStyle: "none", boxShadow: "none" } as any) : null),
    },
    tagsInput: {
      marginTop: 16,
      fontSize: 14,
      color: colors.text,
      borderTopWidth: 1,
      borderTopColor: colors.surfaceMuted,
      paddingTop: 12,
    },
    fileChip: {
      flexDirection: "row",
      alignItems: "center",
      marginTop: 8,
      backgroundColor: colors.surface,
      borderRadius: 10,
      paddingHorizontal: 10,
      paddingVertical: 8,
      borderWidth: 1,
      borderColor: colors.surfaceMuted,
    },
    fileChipText: { flex: 1, color: colors.muted, fontSize: 13 },

    /* Toolbar */
    toolbar: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderTopWidth: 1,
      borderTopColor: colors.surfaceMuted,
      backgroundColor: colors.surface,
      paddingBottom: Platform.OS === "ios" ? 24 : 10,
      gap: 4,
    },
    toolbarBtn: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: "center",
      justifyContent: "center",
    },
    toolbarSendBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.accent,
      alignItems: "center",
      justifyContent: "center",
    },
  });
}
