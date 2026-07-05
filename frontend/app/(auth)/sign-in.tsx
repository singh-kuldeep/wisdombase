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
import { Link } from "expo-router";
import { useAuth } from "../../stores/authStore";
import { colors, fonts } from "../../theme";

type Tab = "password" | "code";
type Channel = "email" | "phone";

export default function SignIn() {
  const { signIn, sendEmailOtp, verifyEmailOtp, sendPhoneOtp, verifyPhoneOtp } = useAuth();
  const [tab, setTab] = useState<Tab>("password");
  const [channel, setChannel] = useState<Channel>("email");
  const [codeSent, setCodeSent] = useState(false);

  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const reset = () => {
    setError(null);
    setNotice(null);
    setCodeSent(false);
    setCode("");
  };

  const run = async (fn: () => Promise<void>, after?: () => void) => {
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      await fn();
      after?.();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const submitPassword = () => run(() => signIn(email.trim(), password));

  const sendCode = () =>
    run(
      () => (channel === "email" ? sendEmailOtp(email.trim()) : sendPhoneOtp(phone.trim())),
      () => {
        setCodeSent(true);
        setNotice(
          channel === "email"
            ? "We emailed you a 6-digit code."
            : "We texted you a 6-digit code.",
        );
      },
    );

  // On success the session updates and the root layout redirects into the app.
  const verifyCode = () =>
    run(() =>
      channel === "email"
        ? verifyEmailOtp(email.trim(), code.trim())
        : verifyPhoneOtp(phone.trim(), code.trim()),
    );

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.inner}>
        <Text style={styles.brand}>WisdomBase</Text>
        <Text style={styles.tagline}>Ask your own thinking.</Text>

        <View style={styles.tabs}>
          <TouchableOpacity
            style={[styles.tab, tab === "password" && styles.tabActive]}
            onPress={() => {
              setTab("password");
              reset();
            }}
          >
            <Text style={[styles.tabText, tab === "password" && styles.tabTextActive]}>
              Password
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, tab === "code" && styles.tabActive]}
            onPress={() => {
              setTab("code");
              reset();
            }}
          >
            <Text style={[styles.tabText, tab === "code" && styles.tabTextActive]}>
              One-time code
            </Text>
          </TouchableOpacity>
        </View>

        {tab === "password" ? (
          <>
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
              placeholder="Password"
              placeholderTextColor={colors.muted}
              secureTextEntry
              value={password}
              onChangeText={setPassword}
            />
            {!!error && <Text style={styles.error}>{error}</Text>}
            <TouchableOpacity style={styles.button} onPress={submitPassword} disabled={busy}>
              <Text style={styles.buttonText}>{busy ? "Signing in…" : "Sign in"}</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <View style={styles.channelRow}>
              {(["email", "phone"] as Channel[]).map((c) => (
                <TouchableOpacity
                  key={c}
                  style={[styles.channelChip, channel === c && styles.channelChipActive]}
                  onPress={() => {
                    setChannel(c);
                    reset();
                  }}
                >
                  <Text
                    style={[styles.channelText, channel === c && styles.channelTextActive]}
                  >
                    {c === "email" ? "Email" : "Phone"}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {channel === "email" ? (
              <TextInput
                style={styles.input}
                placeholder="Email"
                placeholderTextColor={colors.muted}
                autoCapitalize="none"
                keyboardType="email-address"
                value={email}
                onChangeText={setEmail}
                editable={!codeSent}
              />
            ) : (
              <>
                <TextInput
                  style={styles.input}
                  placeholder="Phone (e.g. +14155551234)"
                  placeholderTextColor={colors.muted}
                  keyboardType="phone-pad"
                  value={phone}
                  onChangeText={setPhone}
                  editable={!codeSent}
                />
                <Text style={styles.smsHint}>
                  Phone codes require an SMS provider to be configured. Email codes
                  work right now.
                </Text>
              </>
            )}

            {codeSent && (
              <TextInput
                style={styles.input}
                placeholder="6-digit code"
                placeholderTextColor={colors.muted}
                keyboardType="number-pad"
                value={code}
                onChangeText={setCode}
              />
            )}

            {!!error && <Text style={styles.error}>{error}</Text>}
            {!!notice && <Text style={styles.notice}>{notice}</Text>}

            {!codeSent ? (
              <TouchableOpacity style={styles.button} onPress={sendCode} disabled={busy}>
                <Text style={styles.buttonText}>{busy ? "Sending…" : "Send code"}</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={styles.button} onPress={verifyCode} disabled={busy}>
                <Text style={styles.buttonText}>{busy ? "Verifying…" : "Verify & sign in"}</Text>
              </TouchableOpacity>
            )}
            {codeSent && (
              <TouchableOpacity onPress={sendCode} disabled={busy}>
                <Text style={styles.resend}>Resend code</Text>
              </TouchableOpacity>
            )}
          </>
        )}

        <Link href="/(auth)/sign-up" style={styles.link}>
          New here? Create an account
        </Link>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  inner: { flex: 1, justifyContent: "center", padding: 28 },
  brand: { fontSize: 34, fontFamily: fonts.serif, color: colors.text, textAlign: "center" },
  tagline: { fontSize: 16, color: colors.muted, textAlign: "center", marginBottom: 24 },
  tabs: {
    flexDirection: "row",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 12,
    padding: 4,
    marginBottom: 18,
  },
  tab: { flex: 1, paddingVertical: 10, alignItems: "center", borderRadius: 9 },
  tabActive: { backgroundColor: colors.accent },
  tabText: { color: colors.muted, fontWeight: "600" },
  tabTextActive: { color: "#fff" },
  channelRow: { flexDirection: "row", gap: 10, marginBottom: 12 },
  channelChip: {
    flex: 1,
    paddingVertical: 9,
    alignItems: "center",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  channelChipActive: { backgroundColor: colors.accentSoft, borderColor: colors.accent },
  channelText: { color: colors.muted, fontWeight: "600" },
  channelTextActive: { color: colors.accent },
  smsHint: { color: colors.muted, fontSize: 12, marginBottom: 12, lineHeight: 17, marginTop: -4 },
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
  notice: { color: colors.teal, marginBottom: 12 },
  button: { backgroundColor: colors.accent, borderRadius: 12, padding: 16, alignItems: "center" },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  resend: { color: colors.accent, textAlign: "center", marginTop: 14, fontSize: 14 },
  link: { color: colors.accent, textAlign: "center", marginTop: 20, fontSize: 15 },
});
