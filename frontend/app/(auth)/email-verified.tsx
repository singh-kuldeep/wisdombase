import { useEffect, useState } from "react";
import { StyleSheet, Text, View, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { supabase } from "../../lib/supabase";
import { colors, fonts } from "../../theme";

export default function EmailVerified() {
  const router = useRouter();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");

  useEffect(() => {
    // Check if there's a session (user just confirmed their email)
    const checkSession = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;

        if (data.session) {
          setStatus("success");
          // Redirect to the app after a brief delay
          setTimeout(() => {
            router.replace("/(app)/home");
          }, 2000);
        } else {
          // No session yet, but email was confirmed - user needs to sign in
          setStatus("success");
          setTimeout(() => {
            router.replace("/(auth)/sign-in");
          }, 2000);
        }
      } catch (err) {
        console.error("Email verification error:", err);
        setStatus("error");
      }
    };

    checkSession();
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.inner}>
        {status === "loading" && (
          <>
            <ActivityIndicator size="large" color={colors.accent} />
            <Text style={styles.title}>Verifying your email...</Text>
          </>
        )}

        {status === "success" && (
          <>
            <Text style={styles.successIcon}>✓</Text>
            <Text style={styles.title}>Email verified!</Text>
            <Text style={styles.message}>
              Your email has been successfully verified. Redirecting you now...
            </Text>
          </>
        )}

        {status === "error" && (
          <>
            <Text style={styles.errorIcon}>✕</Text>
            <Text style={styles.title}>Verification failed</Text>
            <Text style={styles.message}>
              There was an issue verifying your email. Please try signing in or contact support.
            </Text>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  inner: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 28,
  },
  successIcon: {
    fontSize: 64,
    color: colors.accent,
    marginBottom: 20,
  },
  errorIcon: {
    fontSize: 64,
    color: colors.danger,
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontFamily: fonts.serif,
    color: colors.text,
    textAlign: "center",
    marginBottom: 16,
  },
  message: {
    fontSize: 16,
    color: colors.muted,
    textAlign: "center",
    lineHeight: 24,
  },
});
