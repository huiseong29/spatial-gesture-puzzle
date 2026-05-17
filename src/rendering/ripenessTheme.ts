import type { InteractionConfidenceState } from "../tracking/handTypes";
import { getThemeTokens } from "../theme/themeTokens";
import type { ThemeMode } from "../theme/themeTypes";

export type RipenessTheme = {
  accent: string;
  accentSoft: string;
  accentGlow: string;
  accentFill: string;
  pulse: number;
};

export function getRipenessTheme(
  confidence: InteractionConfidenceState | null | undefined,
  themeMode: ThemeMode = "dark"
): RipenessTheme {
  const ripeness = confidence?.ripeness ?? 0.55;
  const tokens = getThemeTokens(themeMode);
  const red = interpolateColor(hexToRgb(tokens.tomatoUnripe), hexToRgb(tokens.tomatoPrimary), ripeness);
  const soft = themeMode === "light"
    ? interpolateColor([255, 225, 214], hexToRgb(tokens.tomatoPrimary), ripeness * 0.6)
    : interpolateColor([254, 202, 202], hexToRgb(tokens.tomatoSoft), ripeness);
  const glowAlpha = themeMode === "light" ? 0.14 + ripeness * 0.28 : 0.2 + ripeness * 0.5;
  const fillAlpha = 0.045 + ripeness * 0.075;

  return {
    accent: `rgb(${red.join(", ")})`,
    accentSoft: `rgb(${soft.join(", ")})`,
    accentGlow: `rgba(${red.join(", ")}, ${glowAlpha.toFixed(3)})`,
    accentFill: `rgba(${red.join(", ")}, ${fillAlpha.toFixed(3)})`,
    pulse: 0.7 + ripeness * 0.75
  };
}

function interpolateColor(from: number[], to: number[], t: number) {
  const clamped = Math.min(Math.max(t, 0), 1);
  return from.map((value, index) => Math.round(value + (to[index] - value) * clamped));
}

function hexToRgb(hex: string) {
  const normalized = hex.replace("#", "");
  return [
    Number.parseInt(normalized.slice(0, 2), 16),
    Number.parseInt(normalized.slice(2, 4), 16),
    Number.parseInt(normalized.slice(4, 6), 16)
  ];
}
