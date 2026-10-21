import { Feather } from "@react-native-vector-icons/feather";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, type EkadashiDay } from "@/src/api";
import { fromISODate, toISODate } from "@/src/date";
import { localeOf } from "@/src/i18n";
import { useSettings } from "@/src/settings-context";
import { colors, fonts, radius, spacing } from "@/src/theme";

/** Current streak (counting back from the latest past Ekadashi; today's unmarked fast doesn't break it) and best streak. */
export function computeStats(days: EkadashiDay[], kept: Set<string>, today: string) {
  const past = days.filter((d) => d.date <= today);
  let best = 0;
  let run = 0;
  for (const d of past) {
    run = kept.has(d.date) ? run + 1 : 0;
    best = Math.max(best, run);
  }
  let current = 0;
  for (let i = past.length - 1; i >= 0; i--) {
    if (kept.has(past[i].date)) current++;
    else if (past[i].date === today) continue;
    else break;
  }
  return { current, best, keptCount: past.filter((d) => kept.has(d.date)).length, total: past.length };
}

export default function TrackerScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const { settings, lang, t } = useSettings();
  const today = toISODate(new Date());
  const [year, setYear] = useState(new Date().getFullYear());

  const daysQ = useQuery({
    queryKey: ["ekadashis", settings.lat, settings.lng, year],
    queryFn: () => api.listEkadashis(settings.lat, settings.lng, year),
    staleTime: 1000 * 60 * 60,
  });
  const vratsQ = useQuery({ queryKey: ["vrats", year], queryFn: () => api.listVrats(year) });
  const kept = useMemo(() => new Set((vratsQ.data ?? []).filter((v) => v.kept).map((v) => v.date)), [vratsQ.data]);
  const stats = useMemo(() => computeStats(daysQ.data ?? [], kept, today), [daysQ.data, kept, today]);

  const toggle = async (date: string) => {
    const next = !kept.has(date);
    qc.setQueryData(["vrats", year], (old: { date: string; kept: boolean }[] = []) => [
      ...old.filter((v) => v.date !== date),
      { date, kept: next },
    ]);
    try {
      await api.setVrat(date, next);
    } finally {
      qc.invalidateQueries({ queryKey: ["vrats", year] });
    }
  };

  return (
    <View style={styles.root} testID="tracker-screen">
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <Pressable
          onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))}
          style={styles.iconBtn}
          testID="tracker-back-button"
        >
          <Feather name="arrow-left" size={20} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.title}>{t("vratTracker")}</Text>
        <View style={styles.iconBtn} />
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: spacing.xl, paddingBottom: insets.bottom + spacing.xl }}>
        <View style={styles.statsRow}>
          <Stat icon="zap" label={t("currentStreak")} value={`${stats.current}`} testID="stat-current-streak" highlight />
          <Stat icon="award" label={t("bestStreak")} value={`${stats.best}`} testID="stat-best-streak" />
          <Stat
            icon="check-circle"
            label={t("keptThisYear")}
            value={t("ekadashiCount", { kept: stats.keptCount, total: stats.total })}
            testID="stat-kept-year"
          />
        </View>

        <View style={styles.yearRow}>
          <Pressable onPress={() => setYear((y) => y - 1)} style={styles.navBtn} testID="tracker-prev-year">
            <Feather name="chevron-left" size={20} color={colors.brandSecondary} />
          </Pressable>
          <Text style={styles.year} testID="tracker-year">{year}</Text>
          <Pressable onPress={() => setYear((y) => y + 1)} style={styles.navBtn} testID="tracker-next-year">
            <Feather name="chevron-right" size={20} color={colors.brandSecondary} />
          </Pressable>
        </View>

        {daysQ.isLoading || vratsQ.isLoading ? (
          <ActivityIndicator color={colors.brandSecondary} style={{ marginTop: spacing.xl }} />
        ) : (
          (daysQ.data ?? []).map((d) => {
            const isKept = kept.has(d.date);
            const future = d.date > today;
            const status = future ? t("upcoming") : isKept ? t("kept") : d.date === today ? t("today") : t("missed");
            return (
              <View key={d.date} style={[styles.row, d.date === today && styles.rowToday]} testID={`tracker-row-${d.date}`}>
                <Pressable
                  onPress={() => toggle(d.date)}
                  disabled={future}
                  style={[styles.check, isKept && styles.checkOn, future && { opacity: 0.35 }]}
                  testID={`tracker-check-${d.date}`}
                >
                  {isKept ? <Feather name="check" size={18} color={colors.onBrandSecondary} /> : null}
                </Pressable>
                <Pressable
                  style={{ flex: 1 }}
                  disabled={!d.katha_id}
                  onPress={() => d.katha_id && router.push({ pathname: "/katha/[id]", params: { id: d.katha_id } })}
                >
                  <Text style={styles.rowTitle}>{lang === "hi" ? d.name_hindi : d.name}</Text>
                  <Text style={styles.rowSub}>
                    {fromISODate(d.date).toLocaleDateString(localeOf(lang), { weekday: "short", day: "numeric", month: "short" })}
                    {" · "}
                    {status}
                  </Text>
                </Pressable>
                {d.katha_id ? <Feather name="book-open" size={16} color={colors.muted} /> : null}
              </View>
            );
          })
        )}
        <Text style={styles.note}>{t("trackerNote")}</Text>
      </ScrollView>
    </View>
  );
}

function Stat({ icon, label, value, testID, highlight }: { icon: "zap" | "award" | "check-circle"; label: string; value: string; testID: string; highlight?: boolean }) {
  return (
    <View style={[styles.stat, highlight && styles.statHi]} testID={testID}>
      <Feather name={icon} size={16} color={highlight ? colors.onBrandSecondary : colors.brandSecondary} />
      <Text style={[styles.statValue, highlight && { color: colors.onBrandSecondary }]} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text style={[styles.statLabel, highlight && { color: colors.onBrandSecondary }]} numberOfLines={2}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.xl, paddingBottom: spacing.md },
  title: { color: colors.onSurface, fontFamily: fonts.display, fontSize: 20, flexShrink: 1, textAlign: "center" },
  iconBtn: {
    width: 40, height: 40, borderRadius: radius.pill, backgroundColor: colors.surfaceSecondary,
    alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border,
  },
  statsRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm },
  stat: { flex: 1, padding: spacing.md, borderRadius: radius.lg, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border, gap: 4 },
  statHi: { backgroundColor: colors.brandSecondary, borderColor: colors.brandSecondary },
  statValue: { color: colors.onSurface, fontFamily: fonts.display, fontSize: 24 },
  statLabel: { color: colors.muted, fontFamily: fonts.body, fontSize: 11 },
  yearRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: spacing.lg, marginBottom: spacing.sm },
  navBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  year: { color: colors.brandSecondary, fontFamily: fonts.display, fontSize: 20 },
  row: {
    flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.md, borderRadius: radius.md,
    backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.sm,
  },
  rowToday: { borderColor: colors.brandPrimary },
  check: { width: 36, height: 36, borderRadius: 18, borderWidth: 2, borderColor: colors.brandSecondary, alignItems: "center", justifyContent: "center" },
  checkOn: { backgroundColor: colors.brandSecondary },
  rowTitle: { color: colors.onSurface, fontFamily: fonts.bodyMedium, fontSize: 14 },
  rowSub: { color: colors.muted, fontFamily: fonts.body, fontSize: 12, marginTop: 2 },
  note: { color: colors.muted, fontFamily: fonts.body, fontSize: 11, textAlign: "center", marginTop: spacing.lg, lineHeight: 16 },
});
