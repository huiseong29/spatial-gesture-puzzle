import type { ThemeMode, ThemeTokens } from "./themeTypes";

export const themeTokens: Record<ThemeMode, ThemeTokens> = {
  dark: {
    mode: "dark",
    background: "#170f0d",
    surface: "rgba(36, 20, 17, 0.82)",
    surfaceMuted: "rgba(48, 28, 22, 0.74)",
    textPrimary: "#fff7ed",
    textSecondary: "#f1c7a6",
    tomatoPrimary: "#ef4444",
    tomatoUnripe: "#f89480",
    tomatoSoft: "#fb7185",
    tomatoGlow: "rgba(239, 68, 68, 0.52)",
    cream: "#ffedd5",
    border: "rgba(254, 215, 170, 0.2)",
    lockedAccent: "#86efac",
    lockedFill: "rgba(134, 239, 172, 0.08)",
    shadow: "rgba(24, 10, 8, 0.34)",
    heatmapDim: "rgba(24, 10, 8, 0.46)"
  },
  light: {
    mode: "light",
    background: "#fff7ed",
    surface: "rgba(255, 255, 255, 0.88)",
    surfaceMuted: "rgba(255, 244, 232, 0.88)",
    textPrimary: "#2a1a14",
    textSecondary: "#7a5a4a",
    tomatoPrimary: "#e54848",
    tomatoUnripe: "#f6a08d",
    tomatoSoft: "#ffe1d6",
    tomatoGlow: "rgba(229, 72, 72, 0.34)",
    cream: "#fff4e8",
    border: "rgba(241, 201, 182, 0.92)",
    lockedAccent: "#5fa878",
    lockedFill: "rgba(95, 168, 120, 0.08)",
    shadow: "rgba(88, 46, 34, 0.16)",
    heatmapDim: "rgba(255, 247, 237, 0.62)"
  }
};

export function getThemeTokens(mode: ThemeMode): ThemeTokens {
  return themeTokens[mode];
}
