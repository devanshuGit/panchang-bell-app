import { Feather } from "@react-native-vector-icons/feather";
import { useQueries } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import React from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, type Katha } from "@/src/api";
import type { StringKey } from "@/src/i18n";
import { useSettings } from "@/src/settings-context";
import { colors, fonts, radius, spacing } from "@/src/theme";

const SECTIONS: { cat: Katha["category"]; label: StringKey; icon: "moon" | "star" | "repeat" }[] = [
  { cat: "ekadashi", label: "catEkadashi", icon: "moon" },
  { cat: "festival", label: "catFestival", icon: "star" },
  { cat: "monthly", label: "catMonthly", icon: "repeat" },
];

export default function KathaLibrary() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { lang, t } = useSettings();
  const results = useQueries({
    queries: SECTIONS.map((s) => ({
      queryKey: ["kathas", s.cat],
      queryFn: () => api.listKathas(s.cat),
      staleTime: Infinity,
    })),
  });

  return (
    <View style={styles.root} testID="katha-library-screen">
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <Pressable
          onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))}
          style={styles.iconBtn}
          testID="katha-library-back-button"
        >
          <Feather name="arrow-left" size={20} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.title}>{t("allKathas")}</Text>
        <View style={styles.iconBtn} />
      </View>
      <ScrollView contentContainerStyle={{ paddingHorizontal: spacing.xl, paddingBottom: insets.bottom + spacing.xl }}>
        {SECTIONS.map((s, i) => (
          <View key={s.cat} testID={`katha-section-${s.cat}`}>
            <Text style={styles.sectionTitle}>{t(s.label)}</Text>
            {results[i].isLoading ? (
              <ActivityIndicator color={colors.brandSecondary} />
            ) : (
              (results[i].data ?? []).map((k) => (
                <Pressable
                  key={k.id}
                  onPress={() => router.push({ pathname: "/katha/[id]", params: { id: k.id } })}
                  style={({ pressed }) => [styles.row, pressed && { opacity: 0.8 }]}
                  testID={`katha-item-${k.id}`}
                >
                  <Feather name={s.icon} size={16} color={colors.brandSecondary} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowTitle}>{lang === "hi" ? k.title_hindi : k.title}</Text>
                    {lang === "en" ? <Text style={styles.rowSub}>{k.title_hindi}</Text> : null}
                  </View>
                  <Feather name="chevron-right" size={18} color={colors.muted} />
                </Pressable>
              ))
            )}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.md,
  },
  title: { color: colors.onSurface, fontFamily: fonts.display, fontSize: 22 },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceSecondary,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
  sectionTitle: { color: colors.brandSecondary, fontFamily: fonts.display, fontSize: 20, marginTop: spacing.xl, marginBottom: spacing.md },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
  },
  rowTitle: { color: colors.onSurface, fontFamily: fonts.bodyMedium, fontSize: 15 },
  rowSub: { color: colors.muted, fontFamily: fonts.body, fontSize: 12, marginTop: 2 },
});
