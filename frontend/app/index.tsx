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
import { ensureChannel, ensureNotificationPermission } from "@/src/notifications";
import { defaultSettings, loadSettings, saveSettings } from "@/src/settings-store";
import { colors, fonts, radius, spacing } from "@/src/theme";

const NIGHT_SKY =
  "https://images.unsplash.com/photo-1475274047050-1d0c0975c63e?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA1NzR8MHwxfHNlYXJjaHwxfHxkYXJrJTIwaW5kaWdvJTIwbmlnaHQlMjBza3klMjBzdGFyc3xlbnwwfHx8fDE3OTE1NDQwMzN8MA&ixlib=rb-4.1.0&q=85";

export default function Home() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const [coords, setCoords] = useState({ lat: defaultSettings.lat, lng: defaultSettings.lng });
  const [city, setCity] = useState(defaultSettings.city);

  // Load settings, request location + notification permissions.
  useEffect(() => {
    (async () => {
      const s = await loadSettings();
      setCoords({ lat: s.lat, lng: s.lng });
      setCity(s.city);
      await ensureNotificationPermission();
      await ensureChannel();
      if (s.useDeviceLocation && Platform.OS !== "web") {
        try {
          const perm = await Location.requestForegroundPermissionsAsync();
          if (perm.granted) {
            const pos = await Location.getCurrentPositionAsync({});
            const next = {
              ...s,
              lat: pos.coords.latitude,
              lng: pos.coords.longitude,
            };
            setCoords({ lat: next.lat, lng: next.lng });
            try {
              const places = await Location.reverseGeocodeAsync({
                latitude: next.lat,
                longitude: next.lng,
              });
              if (places[0]?.city) {
                next.city = places[0].city;
                setCity(places[0].city);
              }
            } catch {}
            await saveSettings(next);
          }
        } catch {}
      }
    })();
  }, []);

  const panchangQ = useQuery({
    queryKey: ["panchang", coords.lat, coords.lng],
    queryFn: () => api.getPanchang(coords.lat, coords.lng),
  });

  const weekQ = useQuery({
    queryKey: ["panchang-week", coords.lat, coords.lng],
    queryFn: () => api.getWeek(coords.lat, coords.lng),
  });

  const alarmsQ = useQuery({ queryKey: ["alarms"], queryFn: api.listAlarms });

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
              qc.invalidateQueries({ queryKey: ["panchang-week"] });
              qc.invalidateQueries({ queryKey: ["alarms"] });
            }}
            tintColor={colors.brandSecondary}
          />
        }
      >
        <Header
          city={city}
          onSettings={() => router.push("/settings")}
          testID="header"
        />
        <TithiCard panchang={panchangQ.data} loading={panchangQ.isLoading} />
        <WeekStrip week={weekQ.data} />
        <AlarmsSection
          alarms={alarmsQ.data || []}
          loading={alarmsQ.isLoading}
          onAdd={() => router.push("/alarm-setup")}
          onEdit={(a) => router.push({ pathname: "/alarm-setup", params: { id: a.id } })}
        />
      </ScrollView>

      <AddButton bottom={insets.bottom + spacing.lg} onPress={() => router.push("/alarm-setup")} />
    </View>
  );
}

function Header({
  city,
  onSettings,
  testID,
}: {
  city: string;
  onSettings: () => void;
  testID?: string;
}) {
  const today = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  return (
    <View style={styles.header} testID={testID}>
      <View>
        <Text style={styles.hello}>Namaste 🙏</Text>
        <Text style={styles.date}>{today}</Text>
        <View style={styles.cityRow}>
          <Feather name="map-pin" size={12} color={colors.brandSecondary} />
          <Text style={styles.city}>{city}</Text>
        </View>
      </View>
      <Pressable
        onPress={onSettings}
        style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.7 }]}
        testID="open-settings-button"
      >
        <Feather name="settings" size={20} color={colors.onSurface} />
      </Pressable>
    </View>
  );
}

function TithiCard({ panchang, loading }: { panchang?: Panchang; loading: boolean }) {
  return (
    <View style={styles.cardWrap} testID="tithi-card">
      <BlurView intensity={30} tint="dark" style={styles.blur}>
        <View style={styles.cardInner}>
          <Text style={styles.pakshaChip}>
            {panchang ? `${panchang.paksha_hindi} • ${panchang.paksha} Paksha` : "Today"}
          </Text>
          {loading || !panchang ? (
            <ActivityIndicator color={colors.brandSecondary} style={{ marginTop: spacing.xl }} />
          ) : (
            <>
              <Text style={styles.tithiNameHi}>{panchang.tithi_hindi}</Text>
              <Text style={styles.tithiNameEn}>{panchang.tithi}</Text>
              <View style={styles.progressBarBg}>
                <View
                  style={[styles.progressBarFg, { width: `${Math.min(panchang.progress_pct, 100)}%` }]}
                />
              </View>
              <Text style={styles.progressLabel}>
                {panchang.progress_pct}% through this Tithi
              </Text>

              <View style={styles.row}>
                <InfoCell label="Nakshatra" value={panchang.nakshatra} />
                <InfoCell
                  label="Sunrise"
                  value={formatSunrise(panchang.sunrise_utc)}
                />
              </View>

              <View style={styles.significance}>
                <Feather
                  name={panchang.is_fasting_day ? "star" : "sun"}
                  size={14}
                  color={colors.brandSecondary}
                />
                <Text style={styles.significanceText}>
                  {panchang.significance || "A peaceful day for prayer and reflection."}
                </Text>
              </View>

              {panchang.is_fasting_day ? (
                <View style={styles.fastingBadge}>
                  <Feather name="moon" size={12} color={colors.onBrandSecondary} />
                  <Text style={styles.fastingBadgeText}>Fasting Day (व्रत)</Text>
                </View>
              ) : null}
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
  if (!week?.length) return null;
  return (
    <View style={{ marginTop: spacing.xl }}>
      <Text style={styles.sectionTitle}>Upcoming Tithis</Text>
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
              {new Date(p.date).toLocaleDateString(undefined, {
                weekday: "short",
                day: "numeric",
              })}
            </Text>
            <Text style={[styles.dayChipTithi, idx === 0 && styles.dayChipTithiActive]}>
              {p.tithi}
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
  return (
    <View style={{ marginTop: spacing.xl }}>
      <Text style={styles.sectionTitle}>Daily Reminders</Text>
      {loading ? (
        <ActivityIndicator color={colors.brandSecondary} style={{ marginTop: spacing.lg }} />
      ) : alarms.length === 0 ? (
        <Pressable style={styles.emptyAlarm} onPress={onAdd} testID="empty-add-alarm">
          <Feather name="bell" size={28} color={colors.brandSecondary} />
          <Text style={styles.emptyTitle}>No alarms yet</Text>
          <Text style={styles.emptySub}>
            Set a sacred morning reminder for today's Tithi.
          </Text>
        </Pressable>
      ) : (
        alarms.map((a) => <AlarmRow key={a.id} alarm={a} onEdit={() => onEdit(a)} />)
      )}
    </View>
  );
}

function AlarmRow({ alarm, onEdit }: { alarm: Alarm; onEdit: () => void }) {
  const qc = useQueryClient();
  const [enabled, setEnabled] = useState(alarm.enabled);
  useEffect(() => setEnabled(alarm.enabled), [alarm.enabled]);

  const h12 = ((alarm.hour + 11) % 12) + 1;
  const ampm = alarm.hour < 12 ? "AM" : "PM";
  const timeStr = `${h12}:${alarm.minute.toString().padStart(2, "0")} ${ampm}`;

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
          {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
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
        <Text style={styles.fabText}>Add Alarm</Text>
      </LinearGradient>
    </Pressable>
  );
}

function formatSunrise(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
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
    width: 92,
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
