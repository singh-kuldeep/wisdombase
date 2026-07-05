import { useEffect } from "react";
import { Tabs } from "expo-router";
import { Text } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { seedGeneric } from "../../lib/api";
import { useAuth } from "../../stores/authStore";
import { useEntries } from "../../stores/entryStore";
import { colors } from "../../theme";

function Icon({ label, focused }: { label: string; focused: boolean }) {
  return (
    <Text style={{ fontSize: 11, color: focused ? colors.accent : colors.muted }}>{label}</Text>
  );
}

export default function AppLayout() {
  const userId = useAuth((s) => s.session?.user.id);
  const reloadEntries = useEntries((s) => s.load);

  // Seed the generic cold-start corpus once per user. The backend is also
  // idempotent; the local flag just avoids a redundant call on every launch.
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

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.bg },
        headerTitleStyle: { color: colors.text },
        headerShadowVisible: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{ title: "Home", tabBarIcon: ({ focused }) => <Icon label="⌂" focused={focused} /> }}
      />
      <Tabs.Screen
        name="capture"
        options={{ title: "Capture", tabBarIcon: ({ focused }) => <Icon label="✎" focused={focused} /> }}
      />
      <Tabs.Screen
        name="ask"
        options={{ title: "Ask", tabBarIcon: ({ focused }) => <Icon label="✦" focused={focused} /> }}
      />
      <Tabs.Screen
        name="browse"
        options={{ title: "Browse", tabBarIcon: ({ focused }) => <Icon label="☰" focused={focused} /> }}
      />
      <Tabs.Screen
        name="settings"
        options={{ title: "Settings", tabBarIcon: ({ focused }) => <Icon label="⚙" focused={focused} /> }}
      />
    </Tabs>
  );
}
