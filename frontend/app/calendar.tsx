import { Feather } from "@react-native-vector-icons/feather";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, type Panchang } from "@/src/api";
import { fromISODate, sunriseLabel, toISODate } from "@/src/date";
import { defaultSettings, loadSettings } from "@/src/settings-store";
import { colors, fonts, radius, spacing } from "@/src/theme";

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];

type Mark = "ekadashi" | "purnima" | "amavasya" | null;
const markOf = (p: Panchang): Mark =>
  p.tithi === "Ekadashi" ? "ekadashi" : p.tithi === "Purnima" ? "purnima" : p.tithi === "Amavasya" ? "amavasya" : null;

export default function CalendarScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const now = new Date();
  const [ym, setYm] = useState({ y: now.getFullYear(), m: now.getMonth() + 1 });
  const [coords, setCoords] = useState({ lat: defaultSettings.lat, lng: defaultSettings.lng });
  const [selected, setSelected] = useState<string>(toISODate(now));

  useEffect(() => {
    loadSettings().then((s) => setCoords({ lat: s.lat, lng: s.lng }));
  }, []);

  const monthQ = useQuery({
    queryKey: ["panchang-month", coords.lat, coords.lng, ym.y, ym.m],
    queryFn: () => api.getMonth(coords.lat, coords.lng, ym.y, ym.m),
    staleTime: 1000 * 60 * 60,
  });

  const days = useMemo(() => monthQ.data ?? [], [monthQ.data]);
  const leading = new Date(ym.y, ym.m - 1, 1).getDay();
  const cells: (Panchang | null)[] = [...Array(leading).fill(null), ...days];
  while (cells.length % 7) cells.push(null);

  const selectedDay = days.find((d) => d.date === selected) ?? days[0];
  const festivals = useMemo(
    () =>
      days.filter(
        (d) => d.festivals.length || ["Ekadashi", "Purnima", "Amavasya"].includes(d.tithi),
      ),
    [days],
  );

  const shift = (delta: number) => {
    setYm(({ y, m }) => {
      const nm = m + delta;
      const next = nm < 1 ? { y: y - 1, m: 12 } : nm > 12 ? { y: y + 1, m: 1 } : { y, m: nm };
      setSelected(toISODate(new Date(next.y, next.m - 1, 1)));
      return next;
    });
  };

  const monthName = new Date(ym.y, ym.m - 1, 1).toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });
  const todayIso = toISODate(now);

  return (
    <View style={styles.root} testID="calendar-screen">
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <Pressable onPress={() => router.back()} style={styles.iconBtn} testID="calendar-back-button">
          <Feather name="arrow-left" size={20} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.title}>Festival Calendar</Text>
        <View style={styles.iconBtn} />
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: spacing.xl, paddingBottom: insets.bottom + spacing.xl }}>
        <View style={styles.monthRow}>
          <Pressable onPress={() => shift(-1)} style={styles.navBtn} testID="calendar-prev-month">
            <Feather name="chevron-left" size={20} color={colors.brandSecondary} />
          </Pressable>
          <Text style={styles.monthName} testID="calendar-month-name">{monthName}</Text>
          <Pressable onPress={() => shift(1)} style={styles.navBtn} testID="calendar-next-month">
            <Feather name="chevron-right" size={20} color={colors.brandSecondary} />
          </Pressable>
        </View>

        <View style={styles.weekRow}>
          {WEEKDAYS.map((w, i) => (
            <Text key={i} style={styles.weekday}>{w}</Text>
          ))}
        </View>

        {monthQ.isLoading ? (
          <View style={styles.loading}>
            <ActivityIndicator color={colors.brandSecondary} />
            <Text style={styles.muted}>Reading the Panchang…</Text>
          </View>
        ) : monthQ.isError ? (
          <Pressable style={styles.loading} onPress={() => monthQ.refetch()} testID="calendar-retry">
            <Feather name="refresh-cw" size={18} color={colors.error} />
            <Text style={styles.muted}>Could not load this month. Tap to retry.</Text>
          </Pressable>
        ) : (
          <View style={styles.grid} testID="calendar-grid">
            {cells.map((p, i) =>
              p ? (
                <DayCell
                  key={p.date}
                  p={p}
                  selected={p.date === selectedDay?.date}
                  today={p.date === todayIso}
                  onPress={() => setSelected(p.date)}
                />
              ) : (
                <View key={`e${i}`} style={styles.cell} />
              ),
            )}
          </View>
        )}

        <View style={styles.legend}>
          <Legend color={colors.brandSecondary} label="Ekadashi" />
          <Legend color={colors.onSurface} label="Purnima" />
          <Legend color={colors.borderStrong} label="Amavasya" ring />
          <Legend color={colors.brandPrimary} label="Festival" star />
        </View>

        {selectedDay ? <DayDetail p={selectedDay} /> : null}

        {festivals.length > 0 ? (
          <>
            <Text style={styles.sectionTitle}>This Month</Text>
            {festivals.map((d) => (
              <Pressable
                key={d.date}
                onPress={() => setSelected(d.date)}
                style={styles.listRow}
                testID={`month-event-${d.date}`}
              >
                <View style={styles.listDate}>
                  <Text style={styles.listDay}>{fromISODate(d.date).getDate()}</Text>
                  <Text style={styles.listWk}>
                    {fromISODate(d.date).toLocaleDateString(undefined, { weekday: "short" })}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.listTitle}>{d.festivals[0] ?? `${d.tithi} Vrat`}</Text>
                  <Text style={styles.muted}>
                    {d.paksha} {d.tithi} · {d.masa}
                    {d.festivals.length > 1 ? ` · ${d.festivals.slice(1).join(", ")}` : ""}
                  </Text>
                </View>
              </Pressable>
            ))}
          </>
        ) : null}
        <Text style={styles.footnote}>
          Festivals use the Amanta (North-Indian festival dates) month system and the traditional
          time of day for each festival. Regional observance may differ by a day.
        </Text>
      </ScrollView>
    </View>
  );
}

function DayCell({ p, selected, today, onPress }: { p: Panchang; selected: boolean; today: boolean; onPress: () => void }) {
  const mark = markOf(p);
  return (
    <Pressable onPress={onPress} style={styles.cell} testID={`calendar-day-${p.date}`}>
      <View style={[styles.cellInner, selected && styles.cellSelected, today && !selected && styles.cellToday]}>
        <Text style={[styles.cellNum, selected && { color: colors.onBrandSecondary }]}>
          {fromISODate(p.date).getDate()}
        </Text>
        <Text numberOfLines={1} style={[styles.cellTithi, selected && { color: colors.onBrandSecondary }]}>
          {p.tithi.slice(0, 5)}
        </Text>
        <View style={styles.markRow}>
          {mark === "ekadashi" ? <View style={[styles.dot, { backgroundColor: colors.brandSecondary }]} /> : null}
          {mark === "purnima" ? <View style={[styles.dot, { backgroundColor: colors.onSurface }]} /> : null}
          {mark === "amavasya" ? <View style={[styles.dot, styles.ring]} /> : null}
          {p.festivals.length ? <Feather name="star" size={8} color={colors.brandPrimary} /> : null}
        </View>
      </View>
    </Pressable>
  );
}

function Legend({ color, label, ring, star }: { color: string; label: string; ring?: boolean; star?: boolean }) {
  return (
    <View style={styles.legendItem}>
      {star ? (
        <Feather name="star" size={10} color={color} />
      ) : (
        <View style={[styles.dot, ring ? [styles.ring, { borderColor: color }] : { backgroundColor: color }]} />
      )}
      <Text style={styles.legendText}>{label}</Text>
    </View>
  );
}

function DayDetail({ p }: { p: Panchang }) {
  return (
    <View style={styles.detail} testID="calendar-day-detail">
      <Text style={styles.detailDate}>
        {fromISODate(p.date).toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })}
      </Text>
      <Text style={styles.detailTithi}>{p.tithi_hindi} · {p.tithi}</Text>
      <Text style={styles.muted}>
        {p.paksha} Paksha · {p.masa} · {p.nakshatra} · Sunrise {sunriseLabel(p)}
      </Text>
      {[...p.festivals, ...p.observances].map((f) => (
        <View key={f} style={styles.detailTag}>
          <Feather name="star" size={12} color={colors.brandSecondary} />
          <Text style={styles.detailTagText}>{f}</Text>
        </View>
      ))}
      <Text style={styles.detailSig}>{p.significance}</Text>
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
  monthRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: spacing.sm },
  navBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  monthName: { color: colors.brandSecondary, fontFamily: fonts.display, fontSize: 20 },
  weekRow: { flexDirection: "row", marginTop: spacing.md },
  weekday: { width: `${100 / 7}%`, textAlign: "center", color: colors.muted, fontSize: 11, fontFamily: fonts.bodyMedium },
  grid: { flexDirection: "row", flexWrap: "wrap", marginTop: spacing.xs },
  cell: { width: `${100 / 7}%`, aspectRatio: 0.78, padding: 2 },
  cellInner: {
    flex: 1,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceSecondary,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 2,
  },
  cellSelected: { backgroundColor: colors.brandSecondary },
  cellToday: { borderWidth: 1, borderColor: colors.brandPrimary },
  cellNum: { color: colors.onSurface, fontFamily: fonts.bodyBold, fontSize: 14 },
  cellTithi: { color: colors.muted, fontSize: 8, fontFamily: fonts.body, marginTop: 1 },
  markRow: { flexDirection: "row", gap: 2, height: 8, alignItems: "center", marginTop: 2 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  ring: { borderWidth: 1.5, borderColor: colors.muted, backgroundColor: "transparent" },
  loading: { alignItems: "center", gap: spacing.sm, paddingVertical: spacing["3xl"] },
  legend: { flexDirection: "row", flexWrap: "wrap", gap: spacing.lg, marginTop: spacing.md },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendText: { color: colors.muted, fontSize: 11, fontFamily: fonts.body },
  detail: {
    marginTop: spacing.xl,
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    gap: spacing.sm,
  },
  detailDate: { color: colors.muted, fontSize: 12, fontFamily: fonts.bodyMedium, textTransform: "uppercase", letterSpacing: 0.8 },
  detailTithi: { color: colors.onSurface, fontFamily: fonts.display, fontSize: 24 },
  detailTag: { flexDirection: "row", alignItems: "center", gap: 6 },
  detailTagText: { color: colors.brandSecondary, fontFamily: fonts.bodyMedium, fontSize: 13 },
  detailSig: { color: colors.onSurfaceSecondary, fontSize: 13, lineHeight: 19, fontFamily: fonts.body },
  sectionTitle: { color: colors.onSurface, fontFamily: fonts.display, fontSize: 20, marginTop: spacing.xl, marginBottom: spacing.md },
  listRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceSecondary,
    marginBottom: spacing.sm,
  },
  listDate: { width: 44, alignItems: "center" },
  listDay: { color: colors.brandSecondary, fontFamily: fonts.display, fontSize: 22 },
  listWk: { color: colors.muted, fontSize: 10, fontFamily: fonts.body },
  listTitle: { color: colors.onSurface, fontFamily: fonts.bodyMedium, fontSize: 14 },
  muted: { color: colors.muted, fontSize: 12, fontFamily: fonts.body },
  footnote: { color: colors.muted, fontSize: 11, lineHeight: 16, fontFamily: fonts.body, marginTop: spacing.xl, textAlign: "center" },
});
