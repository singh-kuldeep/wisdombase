import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { ingest } from "../../lib/api";
import { colors, fonts } from "../../theme";

const PROMPTS = [
  "What's the biggest decision you're facing right now?",
  "What's a lesson you learned the hard way?",
  "What's an idea you keep coming back to?",
  "What do you know about your work/field that most don't?",
  "What advice would you give your younger self?",
];

export default function Onboarding() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<string[]>(Array(PROMPTS.length).fill(""));
  const [finishing, setFinishing] = useState(false);

  const setAnswer = (text: string) => {
    setAnswers((a) => a.map((v, i) => (i === step ? text : v)));
  };

  const finish = async () => {
    setFinishing(true);
    const toSave = answers
      .map((content, i) => ({ content: content.trim(), prompt: PROMPTS[i] }))
      .filter((a) => a.content.length > 0);
    try {
      await Promise.all(
        toSave.map((a) => ingest({ title: a.prompt, content: a.content, source: "onboarding" })),
      );
    } catch {
      // Non-blocking: continue into the app even if some saves fail.
    }
    router.replace("/(app)/home");
  };

  const next = () => {
    if (step < PROMPTS.length - 1) setStep(step + 1);
    else finish();
  };

  const isLast = step === PROMPTS.length - 1;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.inner}>
        <Text style={styles.progress}>
          Seed {step + 1} of {PROMPTS.length}
        </Text>
        <Text style={styles.prompt}>{PROMPTS[step]}</Text>
        <TextInput
          style={styles.input}
          placeholder="Write as much or as little as you like…"
          placeholderTextColor={colors.muted}
          multiline
          textAlignVertical="top"
          value={answers[step]}
          onChangeText={setAnswer}
        />

        <View style={styles.actions}>
          <TouchableOpacity onPress={next} disabled={finishing}>
            <Text style={styles.skip}>Skip</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.next} onPress={next} disabled={finishing}>
            <Text style={styles.nextText}>
              {finishing ? "Planting…" : isLast ? "Plant my seeds" : "Next"}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  inner: { flex: 1, padding: 24, paddingTop: 80 },
  progress: { color: colors.muted, fontSize: 13, textTransform: "uppercase", letterSpacing: 1 },
  prompt: { fontSize: 26, fontFamily: fonts.serif, color: colors.text, marginTop: 12, marginBottom: 20, lineHeight: 34 },
  input: {
    flex: 1,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
    fontSize: 17,
    lineHeight: 25,
    color: colors.text,
    fontFamily: fonts.serif,
  },
  actions: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 18 },
  skip: { color: colors.muted, fontSize: 16, paddingVertical: 14, paddingHorizontal: 8 },
  next: { backgroundColor: colors.accent, borderRadius: 12, paddingVertical: 14, paddingHorizontal: 28 },
  nextText: { color: "#fff", fontWeight: "600", fontSize: 16 },
});
