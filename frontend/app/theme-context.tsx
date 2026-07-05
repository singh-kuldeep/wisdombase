import { createContext, useContext, useEffect, useMemo, useState, type PropsWithChildren } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { colors as lightColors, darkColors } from "../theme";

type ThemeMode = "light" | "dark";

type ThemeContextValue = {
  themeMode: ThemeMode;
  colors: typeof lightColors;
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export function ThemeProvider({ children }: PropsWithChildren) {
  const [themeMode, setThemeMode] = useState<ThemeMode>("light");

  useEffect(() => {
    (async () => {
      const storedTheme = await AsyncStorage.getItem("themeMode");
      setThemeMode(storedTheme === "dark" ? "dark" : "light");
    })();
  }, []);

  const colors = themeMode === "dark" ? darkColors : lightColors;

  const toggleTheme = async () => {
    const nextMode: ThemeMode = themeMode === "dark" ? "light" : "dark";
    setThemeMode(nextMode);
    await AsyncStorage.setItem("themeMode", nextMode);
  };

  const value = useMemo(
    () => ({ themeMode, colors, toggleTheme }),
    [themeMode, colors],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const value = useContext(ThemeContext);
  if (!value) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return value;
}
