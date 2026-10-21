// Dark luxe theme for the Panchang Alarm app, filled from design_guidelines.json.
import { useMemo } from "react";
import { Appearance, Platform, StyleSheet, useColorScheme } from "react-native";

export type ColorScheme = "light" | "dark";

const dark = {
  surface: "#0B0F19",
  onSurface: "#F9F5EC",
  surfaceSecondary: "#151B2B",
  onSurfaceSecondary: "#E2E8F0",
  surfaceTertiary: "#1E2538",
  onSurfaceTertiary: "#CBD5E1",
  surfaceInverse: "#F9F5EC",
  onSurfaceInverse: "#0B0F19",
  muted: "#94A3B8",

  brand: "#F59E0B",
  onBrand: "#F9F5EC",
  brandPrimary: "#D97706",
  onBrandPrimary: "#F9F5EC",
  brandSecondary: "#FCD34D",
  onBrandSecondary: "#451A03",
  brandTertiary: "#451A03",
  onBrandTertiary: "#FCD34D",

  success: "#10B981",
  onSuccess: "#064E3B",
  warning: "#F59E0B",
  onWarning: "#451A03",
  error: "#EF4444",
  onError: "#450A0A",
  info: "#EAB308",
  onInfo: "#422006",

  border: "#1E2538",
  borderStrong: "#334155",
  divider: "#1E2538",
};

export type ThemeColors = typeof dark;

export const defaultScheme = "dark" satisfies ColorScheme;

export const themes: { light?: ThemeColors; dark: ThemeColors } = { dark };

export function setColorScheme(scheme: ColorScheme | null) {
  Appearance.setColorScheme?.(scheme ?? "unspecified");
}

setColorScheme?.(themes.light ? null : defaultScheme);

export const colors = dark;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  "2xl": 32,
  "3xl": 48,
};

export const radius = {
  sm: 6,
  md: 12,
  lg: 20,
  pill: 999,
};

import { Platform as _P } from "react-native";

// System serif gives a reverent, editorial feel; sans-serif stays legible for data.
export const fonts = {
  display: _P.select({ ios: "Georgia", android: "serif", default: "Georgia" })!,
  displayBold: _P.select({ ios: "Georgia-Bold", android: "serif", default: "Georgia" })!,
  body: _P.select({ ios: "System", android: "sans-serif", default: "System" })!,
  bodyMedium: _P.select({ ios: "System", android: "sans-serif-medium", default: "System" })!,
  bodyBold: _P.select({ ios: "System", android: "sans-serif", default: "System" })!,
};

export function useTheme(): { scheme: ColorScheme; colors: ThemeColors } {
  const system = useColorScheme();
  const scheme: ColorScheme = system === "light" && themes.light ? "light" : defaultScheme;
  return { scheme, colors: themes[scheme] ?? themes.dark };
}

export function makeStyles<T extends StyleSheet.NamedStyles<T> | StyleSheet.NamedStyles<any>>(
  factory: (colors: ThemeColors) => T & StyleSheet.NamedStyles<any>,
): () => T {
  return function useStyles(): T {
    const { colors } = useTheme();
    return useMemo(() => StyleSheet.create(factory(colors)), [colors]);
  };
}
