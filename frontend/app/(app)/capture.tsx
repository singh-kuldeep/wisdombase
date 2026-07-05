import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import * as DocumentPicker from "expo-document-picker";
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

export default function Capture() {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [group, setGroup] = useState<string>(DEFAULT_GROUP);
  const [tagsInput, setTagsInput] = useState("");
  const [linksInput, setLinksInput] = useState("");
  const [attachments, setAttachments] = useState<PickedFile[]>([]);
  const [busy, setBusy] = useState(false);
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
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.heroBanner}>
          <Text style={styles.heroTitle}>Capture ideas, links, and documents in one flowing notebook.</Text>
          <Text style={styles.heroSubtitle}>Every new thought becomes searchable, ready for later questions and memory building.</Text>
        </View>

        <Text style={styles.label}>Collection</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRow}
          keyboardShouldPersistTaps="handled"
        >
          {GROUPS.map((g) => {
            const active = g === group;
            return (
              <TouchableOpacity
                key={g}
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => setGroup(g)}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{g}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* One generic capture card — write or paste anything. */}
        <View style={styles.card}>
          <TextInput
            style={styles.title}
            placeholder="Title (optional)"
            placeholderTextColor={colors.muted}
            value={title}
            onChangeText={setTitle}
          />
          <View style={styles.divider} />
          <TextInput
            style={styles.body}
            placeholder="Write or paste a thought…"
            placeholderTextColor={colors.muted}
            multiline
            textAlignVertical="top"
            value={content}
            onChangeText={setContent}
          />
          <View style={styles.divider} />
          <TextInput
            style={styles.tags}
            placeholder="Tags, comma separated (optional)"
            placeholderTextColor={colors.muted}
            autoCapitalize="none"
            value={tagsInput}
            onChangeText={setTagsInput}
          />
        </View>

        {/* Unified import — links and files of any supported type. */}
        <Text style={styles.label}>Add from sources</Text>
        <Text style={styles.help}>
          Paste web links or attach files (txt, md, html, pdf). Each becomes its own
          entry; anything unreadable is skipped.
        </Text>

        <TextInput
          style={styles.links}
          placeholder={"Paste web links, one per line"}
          placeholderTextColor={colors.muted}
          multiline
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          textAlignVertical="top"
          value={linksInput}
          onChangeText={setLinksInput}
        />

        <TouchableOpacity style={styles.attach} onPress={pickFiles} disabled={busy}>
          <Text style={styles.attachText}>＋  Attach files</Text>
        </TouchableOpacity>

        {attachments.map((a) => (
          <View key={a.uri} style={styles.fileChip}>
            <Text style={styles.fileChipText} numberOfLines={1}>
              {fileIcon(a.name)}  {a.name}
            </Text>
            <TouchableOpacity onPress={() => removeAttachment(a.uri)} hitSlop={10}>
              <Text style={styles.fileChipX}>✕</Text>
            </TouchableOpacity>
          </View>
        ))}
      </ScrollView>

      <View style={styles.footer}>
        {queued.length > 0 && <Text style={styles.queued}>{queued.join("  ·  ")}</Text>}
        <TouchableOpacity
          style={[styles.primary, (!canSubmit || busy) && styles.disabled]}
          onPress={submit}
          disabled={!canSubmit || busy}
        >
          {busy ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.primaryText}>Add to knowledge base</Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

function createStyles(colors: typeof import("../../theme").colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    content: { padding: 18, paddingBottom: 24 },
    heroBanner: {
    borderRadius: 24,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.surfaceMuted,
    padding: 22,
    marginBottom: 18,
    shadowColor: colors.text,
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 14 },
    shadowRadius: 24,
    elevation: 5,
  },
  heroTitle: { fontSize: 22, fontWeight: "800", color: colors.text, lineHeight: 30, marginBottom: 8 },
  heroSubtitle: { color: colors.muted, fontSize: 15, lineHeight: 22 },
  label: {
    fontSize: 13,
    color: colors.muted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    fontWeight: "700",
    marginTop: 6,
    marginBottom: 10,
  },
  chipRow: { gap: 10, paddingRight: 8, paddingBottom: 2 },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.surfaceMuted,
    backgroundColor: colors.surface,
  },
  chipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipText: { color: colors.muted, fontWeight: "700", fontSize: 13 },
  chipTextActive: { color: "#fff" },
  card: {
    marginTop: 16,
    backgroundColor: colors.surface,
    borderColor: colors.surfaceMuted,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 18,
    shadowColor: colors.text,
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 12 },
    shadowRadius: 20,
    elevation: 4,
  },
  title: { fontSize: 20, fontWeight: "700", color: colors.text, paddingVertical: 18 },
  divider: { height: 1, backgroundColor: colors.surfaceMuted },
  body: {
    minHeight: 160,
    fontSize: 17,
    lineHeight: 25,
    color: colors.text,
    fontFamily: fonts.serif,
    paddingVertical: 16,
  },
  tags: { fontSize: 14, color: colors.text, paddingVertical: 14 },
  help: { color: colors.muted, fontSize: 14, lineHeight: 20, marginBottom: 12 },
  links: {
    minHeight: 64,
    maxHeight: 130,
    backgroundColor: colors.surface,
    borderColor: colors.surfaceMuted,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 14,
    color: colors.text,
  },
  attach: {
    marginTop: 10,
    borderColor: colors.accent,
    borderWidth: 1,
    borderStyle: "dashed",
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: "center",
    backgroundColor: colors.accentSoft,
  },
  attachText: { color: colors.accent, fontWeight: "700", fontSize: 15 },
  fileChip: {
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.surface,
    borderColor: colors.surfaceMuted,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  fileChipText: { flex: 1, color: colors.text, fontSize: 14, marginRight: 10 },
  fileChipX: { color: colors.muted, fontSize: 15, fontWeight: "700" },
  footer: {
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 18,
    borderTopWidth: 1,
    borderTopColor: colors.surfaceMuted,
    backgroundColor: colors.surface,
  },
  queued: { textAlign: "center", color: colors.muted, fontSize: 13, marginBottom: 10 },
  primary: {
    backgroundColor: colors.accent,
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
    shadowColor: colors.accent,
    shadowOpacity: 0.18,
    shadowOffset: { width: 0, height: 12 },
    shadowRadius: 20,
    elevation: 4,
  },
  primaryText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  disabled: { opacity: 0.45 },
  });
}
