import { useEffect, type ComponentProps } from "react";
import { Tabs } from "expo-router";
import { Feather } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Image, TouchableOpacity, Text, View } from "react-native";
import { seedGeneric } from "../../lib/api";
import { useAuth } from "../../stores/authStore";
import { useEntries } from "../../stores/entryStore";
import { useTheme } from "../theme-context";

function HeaderLogo() {
  const { colors } = useTheme();

  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
      <Image
        source={require("../../assets/icon.png")}
        style={{ width: 28, height: 28, borderRadius: 6 }}
        resizeMode="contain"
      />
      <Text style={{ fontSize: 17, fontWeight: "800", color: colors.text, letterSpacing: -0.3 }}>
        Wisdom<Text style={{ fontWeight: "400" }}>Base</Text>
      </Text>
    </View>
  );
}

function Icon({ name, focused }: { name: ComponentProps<typeof Feather>["name"]; focused: boolean }) {
  const { colors } = useTheme();
  return <Feather name={name} size={20} color={focused ? colors.accent : colors.muted} />;
}

function ThemeHeaderButton() {
  const { themeMode, toggleTheme, colors } = useTheme();

  return (
    <TouchableOpacity
      style={{
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 16,
        backgroundColor: colors.surfaceSoft,
        borderWidth: 1,
        borderColor: colors.border,
      }}
      onPress={toggleTheme}
    >
      <Feather name={themeMode === "dark" ? "sun" : "moon"} size={18} color={colors.text} />
      <Text style={{ color: colors.text, fontWeight: "700", fontSize: 13, marginLeft: 8 }}>
        {themeMode === "dark" ? "Light" : "Dark"}
      </Text>
    </TouchableOpacity>
  );
}

function AppLayoutContent() {
  const { colors } = useTheme();

  return (
    <Tabs
      screenOptions={{
        headerStyle: {
          backgroundColor: colors.bg,
          shadowColor: "transparent",
          elevation: 0,
        },
        headerTitleStyle: { color: colors.text, fontWeight: "700" },
        headerTitleAlign: "left",
        headerTitle: () => <HeaderLogo />,
        headerRight: () => <ThemeHeaderButton />,
        headerRightContainerStyle: { paddingRight: 12 },
        headerShadowVisible: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          height: 68,
          paddingBottom: 8,
        },
      }}
    >
      <Tabs.Screen name="home" options={{ title: "Home", tabBarIcon: ({ focused }) => <Icon name="home" focused={focused} /> }} />
      <Tabs.Screen name="ask" options={{ title: "Ask", tabBarIcon: ({ focused }) => <Icon name="message-square" focused={focused} /> }} />
      <Tabs.Screen name="browse" options={{ title: "Browse", tabBarIcon: ({ focused }) => <Icon name="layers" focused={focused} /> }} />
      <Tabs.Screen name="settings" options={{ title: "Settings", tabBarIcon: ({ focused }) => <Icon name="settings" focused={focused} /> }} />
    </Tabs>
  );
}

export default function AppLayout() {
  const userId = useAuth((s) => s.session?.user.id);
  const reloadEntries = useEntries((s) => s.load);

  useEffect(() => {
    if (!userId) return;
    const flag = `generic_seeded_${userId}`;
    let cancelled = false;
    (async () => {
      try {
        if (await AsyncStorage.getItem(flag)) return;
        const res = await seedGeneric();
        await AsyncStorage.setItem(flag, "1");
        if (!cancelled && res.seeded > 0) reloadEntries();
      } catch {
        // Non-blocking: app works fine without the seed; retry next launch.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  return <AppLayoutContent />;
}
