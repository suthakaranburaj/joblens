"use client";

import { useTheme as useNextTheme } from "next-themes";

export function useTheme() {
  const { theme, setTheme, resolvedTheme, systemTheme, themes } = useNextTheme();

  const isDark = resolvedTheme === "dark";
  const isLight = resolvedTheme === "light";

  function toggleTheme() {
    setTheme(isDark ? "light" : "dark");
  }

  return {
    theme,
    setTheme,
    resolvedTheme,
    systemTheme,
    themes,
    isDark,
    isLight,
    toggleTheme,
  };
}
