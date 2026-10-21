import { Feather } from "@react-native-vector-icons/feather";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BlurView } from "expo-blur";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import * as Location from "expo-location";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, type Alarm, type Panchang } from "@/src/api";
import { FloatingOm } from "@/src/components/floating-om";
import { fromISODate, sunriseLabel, toISODate } from "@/src/date";
import {
  ensureChannel,
  ensureNotificationPermission,
  syncAlarmSchedules,
} from "@/src/notifications";
import { formatTime, localeOf, localizeTimes, lp, WEEK_LETTERS } from "@/src/i18n";
import { useSettings } from "@/src/settings-context";
import { colors, fonts, radius, spacing } from "@/src/theme";

const NIGHT_SKY =
  "https://images.unsplash.com/photo-1475274047050-1d0c0975c63e?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA1NzR8MHwxfHNlYXJjaHwxfHxkYXJrJTIwaW5kaWdvJTIwbmlnaHQlMjBza3klMjBzdGFyc3xlbnwwfHx8fDE3OTE1NDQwMzN8MA&ixlib=rb-4.1.0&q=85";

export default function Home() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const { settings, ready, update, lang, t } = useSettings();
  const coords = { lat: settings.lat, lng: settings.lng };

  // Request notification + location permissions once settings are loaded.
  useEffect(() => {
    if (!ready) return;
    (async () => {
      await ensureNotificationPermission();
      await ensureChannel();
      if (settings.useDeviceLocation && Platform.OS !== "web") {
        try {
          const perm = await Location.requestForegroundPermissionsAsync();
          if (perm.granted) {
            const pos = await Location.getCurrentPositionAsync({});
            let city = settings.city;
            try {
              const places = await Location.reverseGeocodeAsync({
                latitude: pos.coords.latitude,
                longitude: pos.coords.longitude,
              });
              city = places[0]?.city || city;
            } catch {}
            update({ lat: pos.coords.latitude, lng: pos.coords.longitude, city });
          }
        } catch {}
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once after settings load
  }, [ready]);

  const today = toISODate(new Date());
  const panchangQ = useQuery({
    queryKey: ["panchang", coords.lat, coords.lng, today],
    queryFn: () => api.getPanchang(coords.lat, coords.lng, today),
    enabled: ready,
  });

  // 30 days ahead: drives the week strip and the dated notifications.
  const rangeQ = useQuery({
    queryKey: ["panchang-range", coords.lat, coords.lng, today],
    queryFn: () => api.getRange(coords.lat, coords.lng, today, 30),
    enabled: ready,
  });

  const alarmsQ = useQuery({ queryKey: ["alarms"], queryFn: api.listAlarms });

  const { eveningEnabled, eveningHour, eveningMinute, defaultSound } = settings;
  useEffect(() => {
    if (alarmsQ.data && rangeQ.data) {
      syncAlarmSchedules(alarmsQ.data, rangeQ.data, {
        lang,
        evening: { enabled: eveningEnabled, hour: eveningHour, minute: eveningMinute, sound: defaultSound },
      }).catch((e) => console.warn("sync failed", e));
    }
  }, [alarmsQ.data, rangeQ.data, lang, eveningEnabled, eveningHour, eveningMinute, defaultSound]);

  const refreshing = panchangQ.isRefetching || alarmsQ.isRefetching;

  return (
    <View style={styles.root} testID="home-screen">
      <Image source={{ uri: NIGHT_SKY }} style={StyleSheet.absoluteFill} contentFit="cover" />
      <LinearGradient
        colors={["rgba(11,15,25,0.6)", "rgba(11,15,25,0.92)", "#0B0F19"]}
        style={StyleSheet.absoluteFill}
      />
      <FloatingOm count={6} />

      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + spacing.lg,
          paddingBottom: insets.bottom + 120,
          paddingHorizontal: spacing.xl,
        }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              qc.invalidateQueries({ queryKey: ["panchang"] });
              qc.invalidateQueries({ queryKey: ["panchang-range"] });
              qc.invalidateQueries({ queryKey: ["alarms"] });
            }}
            tintColor={colors.brandSecondary}
          />
        }
      >
        <Header
          city={settings.city}
          onSettings={() => router.push("/settings")}
          onCalendar={() => router.push("/calendar")}
          onShare={() => router.push("/share")}
          testID="header"
        />
        <TithiCard panchang={panchangQ.data} loading={panchangQ.isLoading} />
        <WeekStrip week={rangeQ.data?.slice(0, 7)} />
        <AlarmsSection
          alarms={alarmsQ.data || []}
          loading={alarmsQ.isLoading}
          onAdd={() => router.push("/alarm-setup")}
          onEdit={(a) => router.push({ pathname: "/alarm-setup", params: { id: a.id } })}
        />
        <Pressable
          onPress={() => router.push("/settings")}
          style={styles.eveningCard}
          testID="evening-reminder-card"
        >
          <Feather name="sunset" size={20} color={colors.brandSecondary} />
          <View style={{ flex: 1 }}>
            <Text style={styles.eveningTitle}>{t("eveningCardTitle")}</Text>
            <Text style={styles.eveningSub}>
              {t("eveningCardSub", { time: formatTime(eveningHour, eveningMinute, lang) })}
            </Text>
          </View>
          <Text
            style={[styles.eveningState, !eveningEnabled && { color: colors.muted }]}
            testID="evening-reminder-state"
          >
            {eveningEnabled ? t("on") : t("off")}
          </Text>
        </Pressable>
        <Text style={styles.attribution} testID="panchang-attribution">
          {panchangQ.data?.source === "calculated" ? t("attributionCalc") : t("attributionOnline")}
        </Text>
      </ScrollView>

      <AddButton bottom={insets.bottom + spacing.lg} onPress={() => router.push("/alarm-setup")} />
    </View>
  );
}

function Header({
  city,
  onSettings,
  onCalendar,
  onShare,
  testID,
}: {
  city: string;
  onSettings: () => void;
  onCalendar: () => void;
  onShare: () => void;
  testID?: string;
}) {
  const { lang, t } = useSettings();
  const router = useRouter();
  const today = new Date().toLocaleDateString(localeOf(lang), {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  return (
    <View style={styles.header} testID={testID}>
      <View>
        <Text style={styles.hello}>{t("namaste")}</Text>
        <Text style={styles.date} testID="header-date">{today}</Text>
        <View style={styles.cityRow}>
          <Feather name="map-pin" size={12} color={colors.brandSecondary} />
          <Text style={styles.city}>{city}</Text>
        </View>
      </View>
      <View style={styles.headerActions}>
        {[
          { icon: "book-open" as const, onPress: () => router.push("/kathas"), id: "open-kathas-button" },
          { icon: "calendar" as const, onPress: onCalendar, id: "open-calendar-button" },
          { icon: "share-2" as const, onPress: onShare, id: "open-share-button" },
          { icon: "settings" as const, onPress: onSettings, id: "open-settings-button" },
        ].map((b) => (
          <Pressable
            key={b.id}
            onPress={b.onPress}
            style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.7 }]}
            testID={b.id}
          >
            <Feather name={b.icon} size={19} color={colors.onSurface} />
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function TithiCard({ panchang, loading }: { panchang?: Panchang; loading: boolean }) {
  const { lang, t } = useSettings();
  const router = useRouter();
  const l = panchang ? lp(panchang, lang) : null;
  return (
    <View style={styles.cardWrap} testID="tithi-card">
      <BlurView intensity={30} tint="dark" style={styles.blur}>
        <View style={styles.cardInner}>
          <Text style={styles.pakshaChip}>
            {panchang
              ? lang === "hi"
                ? panchang.paksha_hindi
                : `${panchang.paksha_hindi} • ${panchang.paksha} Paksha`
              : t("today")}
          </Text>
          {loading || !panchang || !l ? (
            <ActivityIndicator color={colors.brandSecondary} style={{ marginTop: spacing.xl }} />
          ) : (
            <>
              <Text style={styles.tithiNameHi} testID="today-tithi-hindi">{panchang.tithi_hindi}</Text>
              <Text style={styles.tithiNameEn} testID="today-tithi-name">
                {lang === "hi" ? l.tithiFull : panchang.tithi}
              </Text>
              <Text style={styles.masaLine} testID="today-masa">
                {lang === "hi" ? l.masa : `${panchang.masa_hindi} मास · ${panchang.masa}`}
              </Text>
              {l.festivals.length > 0 ? (
                <View style={styles.festivalBanner} testID="today-festival">
                  <Feather name="star" size={14} color={colors.onBrandSecondary} />
                  <Text style={styles.festivalText}>{l.festivals.join(" · ")}</Text>
                </View>
              ) : null}
              <View style={styles.progressBarBg}>
                <View
                  style={[styles.progressBarFg, { width: `${Math.min(panchang.progress_pct, 100)}%` }]}
                />
              </View>
              <Text style={styles.progressLabel}>
                {t("throughTithi", { pct: panchang.progress_pct })}
              </Text>

              <View style={styles.row}>
                <InfoCell label={t("nakshatra")} value={l.nakshatra} />
                <InfoCell label={t("sunrise")} value={localizeTimes(sunriseLabel(panchang), lang)} />
              </View>
              {l.yoga || panchang.rahu_kalam ? (
                <View style={[styles.row, { marginTop: spacing.md }]}>
                  {l.yoga ? <InfoCell label={t("yoga")} value={l.yoga} /> : null}
                  {panchang.rahu_kalam ? (
                    <InfoCell label={t("rahuKaal")} value={localizeTimes(panchang.rahu_kalam, lang)} />
                  ) : null}
                </View>
              ) : null}

              <View style={styles.significance}>
                <Feather
                  name={panchang.is_fasting_day ? "star" : "sun"}
                  size={14}
                  color={colors.brandSecondary}
                />
                <Text style={styles.significanceText} testID="today-significance">
                  {l.significance || t("peaceful")}
                </Text>
              </View>

              {panchang.is_fasting_day ? (
                <View style={styles.fastingBadge}>
                  <Feather name="moon" size={12} color={colors.onBrandSecondary} />
                  <Text style={styles.fastingBadgeText}>{t("fastingDay")}</Text>
                </View>
              ) : null}
              {panchang.kathas.map((k) => (
                <Pressable
                  key={k.id}
                  onPress={() => router.push({ pathname: "/katha/[id]", params: { id: k.id } })}
                  style={({ pressed }) => [styles.kathaBtn, pressed && { opacity: 0.8 }]}
                  testID={`today-katha-${k.id}`}
                >
                  <Feather name="book-open" size={16} color={colors.brandSecondary} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.kathaBtnLabel}>{t("readKatha")}</Text>
                    <Text style={styles.kathaBtnTitle}>{lang === "hi" ? k.title_hindi : k.title}</Text>
                  </View>
                  <Feather name="chevron-right" size={18} color={colors.brandSecondary} />
                </Pressable>
              ))}
            </>
          )}
        </View>
      </BlurView>
    </View>
  );
}

function InfoCell({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.cell}>
      <Text style={styles.cellLabel}>{label}</Text>
      <Text style={styles.cellValue}>{value}</Text>
    </View>
  );
}

function WeekStrip({ week }: { week?: Panchang[] }) {
  const { lang, t } = useSettings();
  if (!week?.length) return null;
  return (
    <View style={{ marginTop: spacing.xl }}>
      <Text style={styles.sectionTitle}>{t("upcomingTithis")}</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: spacing.md, paddingVertical: spacing.sm }}
      >
        {week.map((p, idx) => (
          <View
            key={p.date}
            style={[styles.dayChip, idx === 0 && styles.dayChipActive]}
            testID={`day-chip-${idx}`}
          >
            <Text style={[styles.dayChipDate, idx === 0 && styles.dayChipDateActive]}>
              {fromISODate(p.date).toLocaleDateString(localeOf(lang), {
                weekday: "short",
                day: "numeric",
              })}
            </Text>
            <Text
              numberOfLines={1}
              adjustsFontSizeToFit
              style={[styles.dayChipTithi, idx === 0 && styles.dayChipTithiActive]}
            >
              {lp(p, lang).tithi}
            </Text>
            <Text style={styles.dayChipPaksha}>
              {p.paksha === "Shukla" ? "शुक्ल" : "कृष्ण"}
            </Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

function AlarmsSection({
  alarms,
  loading,
  onAdd,
  onEdit,
}: {
  alarms: Alarm[];
  loading: boolean;
  onAdd: () => void;
  onEdit: (a: Alarm) => void;
}) {
  const { t } = useSettings();
  return (
    <View style={{ marginTop: spacing.xl }}>
      <Text style={styles.sectionTitle}>{t("dailyReminders")}</Text>
      {loading ? (
        <ActivityIndicator color={colors.brandSecondary} style={{ marginTop: spacing.lg }} />
      ) : alarms.length === 0 ? (
        <Pressable style={styles.emptyAlarm} onPress={onAdd} testID="empty-add-alarm">
          <Feather name="bell" size={28} color={colors.brandSecondary} />
          <Text style={styles.emptyTitle}>{t("noAlarms")}</Text>
          <Text style={styles.emptySub}>{t("noAlarmsSub")}</Text>
        </Pressable>
      ) : (
        alarms.map((a) => <AlarmRow key={a.id} alarm={a} onEdit={() => onEdit(a)} />)
      )}
    </View>
  );
}

function AlarmRow({ alarm, onEdit }: { alarm: Alarm; onEdit: () => void }) {
  const qc = useQueryClient();
  const { lang } = useSettings();
  const [enabled, setEnabled] = useState(alarm.enabled);
  useEffect(() => setEnabled(alarm.enabled), [alarm.enabled]);

  const timeStr = formatTime(alarm.hour, alarm.minute, lang);

  return (
    <Pressable
      onPress={onEdit}
      style={({ pressed }) => [styles.alarmRow, pressed && { opacity: 0.85 }]}
      testID={`alarm-row-${alarm.id}`}
    >
      <View style={{ flex: 1 }}>
        <Text style={styles.alarmTime}>{timeStr}</Text>
        <Text style={styles.alarmLabel}>{alarm.label}</Text>
        <View style={styles.daysRow}>
          {WEEK_LETTERS[lang].map((d, i) => (
            <View
              key={i}
              style={[styles.dayDot, alarm.days.includes(i) && styles.dayDotOn]}
            >
              <Text
                style={[
                  styles.dayDotText,
                  alarm.days.includes(i) && styles.dayDotTextOn,
                ]}
              >
                {d}
              </Text>
            </View>
          ))}
        </View>
      </View>
      <Switch
        value={enabled}
        onValueChange={async (v) => {
          setEnabled(v);
          await api.updateAlarm(alarm.id, { enabled: v });
          qc.invalidateQueries({ queryKey: ["alarms"] });
        }}
        trackColor={{ false: colors.surfaceTertiary, true: colors.brandPrimary }}
        thumbColor={enabled ? colors.brandSecondary : colors.muted}
        testID={`alarm-toggle-${alarm.id}`}
      />
    </Pressable>
  );
}

function AddButton({ bottom, onPress }: { bottom: number; onPress: () => void }) {
  const { t } = useSettings();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.fab,
        { bottom },
        pressed && { transform: [{ scale: 0.97 }] },
      ]}
      testID="add-alarm-fab"
    >
      <LinearGradient
        colors={[colors.brandSecondary, colors.brandPrimary]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.fabInner}
      >
        <Feather name="plus" size={22} color={colors.onBrandSecondary} />
        <Text style={styles.fabText}>{t("addAlarm")}</Text>
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  headerActions: { flexDirection: "row", gap: spacing.sm },
  kathaBtn: {
    marginTop: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.brandPrimary,
    backgroundColor: colors.brandTertiary,
  },
  kathaBtnLabel: { color: colors.brandSecondary, fontFamily: fonts.bodyBold, fontSize: 11, letterSpacing: 0.8, textTransform: "uppercase" },
  kathaBtnTitle: { color: colors.onSurface, fontFamily: fonts.display, fontSize: 16, marginTop: 2 },
  eveningCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: spacing.sm,
  },
  eveningTitle: { color: colors.onSurface, fontFamily: fonts.bodyMedium, fontSize: 14 },
  eveningSub: { color: colors.muted, fontFamily: fonts.body, fontSize: 12, marginTop: 2 },
  eveningState: { color: colors.brandSecondary, fontFamily: fonts.bodyBold, fontSize: 13 },
  masaLine: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 13,
    marginTop: spacing.xs,
  },
  festivalBanner: {
    marginTop: spacing.md,
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.brandSecondary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
  },
  festivalText: {
    color: colors.onBrandSecondary,
    fontFamily: fonts.bodyBold,
    fontSize: 13,
    flexShrink: 1,
  },
  attribution: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 11,
    textAlign: "center",
    marginTop: spacing.xl,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.xl,
  },
  hello: {
    color: colors.brandSecondary,
    fontFamily: fonts.display,
    fontSize: 28,
    letterSpacing: 0.5,
  },
  date: {
    color: colors.onSurfaceSecondary,
    fontFamily: fonts.body,
    fontSize: 13,
    marginTop: 2,
  },
  cityRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 },
  city: { color: colors.muted, fontSize: 12, fontFamily: fonts.body },
  iconBtn: {
    width: 42,
    height: 42,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceSecondary,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardWrap: {
    borderRadius: radius.lg,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  blur: { backgroundColor: "rgba(21,27,43,0.75)" },
  cardInner: { padding: spacing.xl },
  pakshaChip: {
    alignSelf: "flex-start",
    color: colors.brandSecondary,
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    fontFamily: fonts.bodyMedium,
    backgroundColor: colors.brandTertiary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.pill,
    overflow: "hidden",
  },
  tithiNameHi: {
    color: colors.onSurface,
    fontFamily: fonts.display,
    fontSize: 44,
    marginTop: spacing.md,
    letterSpacing: 1,
  },
  tithiNameEn: {
    color: colors.brandSecondary,
    fontFamily: fonts.display,
    fontSize: 20,
    marginTop: 2,
    fontStyle: "italic",
  },
  progressBarBg: {
    height: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceTertiary,
    marginTop: spacing.lg,
    overflow: "hidden",
  },
  progressBarFg: { height: 4, backgroundColor: colors.brandPrimary, borderRadius: radius.pill },
  progressLabel: {
    color: colors.muted,
    fontSize: 11,
    fontFamily: fonts.body,
    marginTop: spacing.xs,
  },
  row: {
    flexDirection: "row",
    marginTop: spacing.xl,
    gap: spacing.md,
  },
  cell: {
    flex: 1,
    backgroundColor: colors.surfaceTertiary,
    padding: spacing.md,
    borderRadius: radius.md,
  },
  cellLabel: {
    color: colors.muted,
    fontSize: 11,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    fontFamily: fonts.body,
  },
  cellValue: {
    color: colors.onSurface,
    fontSize: 15,
    marginTop: 4,
    fontFamily: fonts.bodyMedium,
  },
  significance: {
    marginTop: spacing.xl,
    flexDirection: "row",
    gap: spacing.sm,
    alignItems: "flex-start",
  },
  significanceText: {
    color: colors.onSurfaceSecondary,
    fontSize: 13,
    flex: 1,
    lineHeight: 20,
    fontFamily: fonts.body,
  },
  fastingBadge: {
    marginTop: spacing.lg,
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.brandSecondary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.pill,
  },
  fastingBadgeText: {
    color: colors.onBrandSecondary,
    fontSize: 12,
    fontFamily: fonts.bodyBold,
    letterSpacing: 0.5,
  },
  sectionTitle: {
    color: colors.onSurface,
    fontFamily: fonts.display,
    fontSize: 20,
    marginBottom: spacing.md,
  },
  dayChip: {
    flexShrink: 0,
    width: 108,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  dayChipActive: {
    borderColor: colors.brandSecondary,
    backgroundColor: colors.brandTertiary,
  },
  dayChipDate: {
    color: colors.muted,
    fontSize: 11,
    fontFamily: fonts.body,
  },
  dayChipDateActive: { color: colors.brandSecondary },
  dayChipTithi: {
    color: colors.onSurface,
    fontFamily: fonts.display,
    fontSize: 15,
    marginTop: 4,
  },
  dayChipTithiActive: { color: colors.brandSecondary },
  dayChipPaksha: {
    color: colors.muted,
    fontSize: 11,
    fontFamily: fonts.body,
    marginTop: 2,
  },
  emptyAlarm: {
    alignItems: "center",
    padding: spacing.xl,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.borderStrong,
    backgroundColor: colors.surfaceSecondary,
    gap: spacing.sm,
  },
  emptyTitle: {
    color: colors.onSurface,
    fontFamily: fonts.display,
    fontSize: 18,
  },
  emptySub: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 13,
    textAlign: "center",
  },
  alarmRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
    gap: spacing.md,
  },
  alarmTime: {
    color: colors.onSurface,
    fontFamily: fonts.display,
    fontSize: 28,
  },
  alarmLabel: {
    color: colors.brandSecondary,
    fontFamily: fonts.body,
    fontSize: 13,
    marginTop: 2,
  },
  daysRow: {
    flexDirection: "row",
    gap: 6,
    marginTop: spacing.md,
  },
  dayDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.surfaceTertiary,
    alignItems: "center",
    justifyContent: "center",
  },
  dayDotOn: { backgroundColor: colors.brandPrimary },
  dayDotText: { color: colors.muted, fontSize: 11, fontFamily: fonts.bodyBold },
  dayDotTextOn: { color: colors.onBrandPrimary },
  fab: {
    position: "absolute",
    left: spacing.xl,
    right: spacing.xl,
    borderRadius: radius.pill,
    shadowColor: colors.brandSecondary,
    shadowOpacity: 0.4,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  fabInner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    paddingVertical: spacing.lg,
    borderRadius: radius.pill,
  },
  fabText: {
    color: colors.onBrandSecondary,
    fontFamily: fonts.bodyBold,
    fontSize: 15,
    letterSpacing: 0.5,
  },
});
