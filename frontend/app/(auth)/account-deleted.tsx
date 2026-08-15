import { Link, useLocalSearchParams } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { colors, fonts } from "../../theme";

export default function AccountDeleted() {
  const params = useLocalSearchParams<{ email?: string }>();
  const email = typeof params.email === "string" ? params.email : "";

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Account deleted</Text>
        <Text style={styles.message}>
          Your account and data have been deleted.
        </Text>
        <Text style={styles.message}>
          You can create another account to continue using WisdomBase.
        </Text>
        {!!email && <Text style={styles.email}>Previous account: {email}</Text>}

        <Link href="/(auth)/sign-up" style={styles.link}>
          Create a new account
        </Link>
        <Link href="/(auth)/sign-in" style={styles.secondaryLink}>
          Back to sign in
        </Link>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
    justifyContent: "center",
    padding: 24,
  },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: 20,
  },
  title: {
    fontSize: 28,
    fontFamily: fonts.serif,
    color: colors.text,
    marginBottom: 10,
  },
  message: {
    color: colors.muted,
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 8,
  },
  email: {
    color: colors.text,
    fontSize: 14,
    marginTop: 4,
    marginBottom: 16,
  },
  link: {
    color: colors.accent,
    fontSize: 16,
    fontWeight: "600",
    marginTop: 8,
  },
  secondaryLink: {
    color: colors.muted,
    fontSize: 14,
    marginTop: 14,
  },
});
