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
import { Link, useRouter } from "expo-router";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../stores/authStore";
import { colors, fonts } from "../../theme";

export default function SignUp() {
  const signUp = useAuth((s) => s.signUp);
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      await signUp(email.trim(), password, phone.trim() || undefined);
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        router.replace("/onboarding");
      } else {
        setNotice("Check your email to confirm your account, then sign in.");
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.inner}>
        <Text style={styles.brand}>Create your space</Text>
        <Text style={styles.tagline}>A private home for your thinking.</Text>

        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor={colors.muted}
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />
        <TextInput
          style={styles.input}
          placeholder="Mobile number (optional, e.g. +14155551234)"
          placeholderTextColor={colors.muted}
          keyboardType="phone-pad"
          value={phone}
          onChangeText={setPhone}
        />
        <TextInput
          style={styles.input}
          placeholder="Password (min 6 characters)"
          placeholderTextColor={colors.muted}
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />

        {!!error && <Text style={styles.error}>{error}</Text>}
        {!!notice && <Text style={styles.notice}>{notice}</Text>}

        <TouchableOpacity style={styles.button} onPress={submit} disabled={busy}>
          <Text style={styles.buttonText}>{busy ? "Creating…" : "Create account"}</Text>
        </TouchableOpacity>

        <Link href="/(auth)/sign-in" style={styles.link}>
          Already have an account? Sign in
        </Link>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  inner: { flex: 1, justifyContent: "center", padding: 28 },
  brand: { fontSize: 30, fontFamily: fonts.serif, color: colors.text, textAlign: "center" },
  tagline: { fontSize: 16, color: colors.muted, textAlign: "center", marginBottom: 32 },
  input: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    color: colors.text,
    marginBottom: 12,
  },
  error: { color: colors.danger, marginBottom: 12 },
  notice: { color: colors.accent, marginBottom: 12 },
  button: { backgroundColor: colors.accent, borderRadius: 12, padding: 16, alignItems: "center" },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  link: { color: colors.accent, textAlign: "center", marginTop: 20, fontSize: 15 },
});
