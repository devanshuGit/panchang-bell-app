import { Feather } from "@react-native-vector-icons/feather";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createAudioPlayer } from "expo-audio";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api";
import { formatTime, WEEK_SHORT, type StringKey } from "@/src/i18n";
import { ensureNotificationPermission } from "@/src/notifications";
import { useSettings } from "@/src/settings-context";
import { colors, fonts, radius, spacing } from "@/src/theme";

const SOUNDS: { key: string; labelKey: StringKey; hindi: string; file: number | null }[] = [
  { key: "om", labelKey: "soundOm", hindi: "ॐ", file: require("../assets/sounds/om.wav") },
  { key: "bell", labelKey: "soundBell", hindi: "🔔", file: require("../assets/sounds/bell.wav") },
  { key: "default", labelKey: "soundDefault", hindi: "🔊", file: null },
];

const DAY_INDEXES = [0, 1, 2, 3, 4, 5, 6];

export default function AlarmSetup() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const existingQ = useQuery({
    queryKey: ["alarms"],
    queryFn: api.listAlarms,
    enabled: !!id,
  });
  const existing = useMemo(
    () => existingQ.data?.find((a) => a.id === id),
    [existingQ.data, id],
  );

  const [time, setTime] = useState<Date>(() => {
    const d = new Date();
    d.setHours(6, 0, 0, 0);
    return d;
  });
  const { settings, lang, t } = useSettings();
  const [label, setLabel] = useState(() => t("defaultLabel"));
  const [sound, setSound] = useState(settings.defaultSound);
  const [days, setDays] = useState<number[]>([0, 1, 2, 3, 4, 5, 6]);
  const [saving, setSaving] = useState(false);
  const [showPicker, setShowPicker] = useState(Platform.OS === "ios");

  useEffect(() => {
    if (existing) {
      const d = new Date();
      d.setHours(existing.hour, existing.minute, 0, 0);
      setTime(d);
      setLabel(existing.label);
      setSound(existing.sound);
      setDays(existing.days);
    }
  }, [existing]);

  // Defaults for a new alarm follow the (possibly late-loading) language and sound settings.
  useEffect(() => {
    if (!id) setLabel(t("defaultLabel"));
  }, [id, t]);
  useEffect(() => {
    if (!id) setSound(settings.defaultSound);
  }, [id, settings.defaultSound]);

  const close = () => (router.canGoBack() ? router.back() : router.replace("/"));

  const playerRef = React.useRef<ReturnType<typeof createAudioPlayer> | null>(null);
  useEffect(() => () => playerRef.current?.remove(), []);

  const previewSound = (key: string) => {
    const s = SOUNDS.find((x) => x.key === key);
    if (!s?.file) return;
    playerRef.current?.remove();
    const player = createAudioPlayer(s.file);
    playerRef.current = player;
    player.play();
  };

  const toggleDay = (idx: number) =>
    setDays((prev) =>
      prev.includes(idx) ? prev.filter((d) => d !== idx) : [...prev, idx].sort(),
    );

  // Notifications are (re)scheduled by the home screen whenever the alarm list changes.
  const save = async () => {
    setSaving(true);
    try {
      await ensureNotificationPermission();
      const data = {
        label,
        hour: time.getHours(),
        minute: time.getMinutes(),
        sound,
        days,
        enabled: true,
      };
      if (existing) await api.updateAlarm(existing.id, data);
      else await api.createAlarm({ ...data, notification_id: null });
      await qc.invalidateQueries({ queryKey: ["alarms"] });
      close();
    } catch (e) {
      console.warn("save failed", e);
    } finally {
      setSaving(false);
    }
  };

  const del = async () => {
    if (!existing) return;
    setSaving(true);
    try {
      await api.deleteAlarm(existing.id);
      await qc.invalidateQueries({ queryKey: ["alarms"] });
      close();
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.root} testID="alarm-setup-screen">
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <Pressable
          onPress={() => close()}
          style={styles.iconBtn}
          testID="back-button"
        >
          <Feather name="x" size={20} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.title}>{existing ? t("editAlarm") : t("newAlarm")}</Text>
        {existing ? (
          <Pressable onPress={del} style={styles.iconBtn} testID="delete-alarm-button">
            <Feather name="trash-2" size={18} color={colors.error} />
          </Pressable>
        ) : (
          <View style={styles.iconBtn} />
        )}
      </View>

      <ScrollView
        contentContainerStyle={{
          padding: spacing.xl,
          paddingBottom: insets.bottom + 120,
        }}
      >
        <Text style={styles.sectionLabel}>{t("alarmTime")}</Text>
        <View style={styles.timeCard}>
          {Platform.OS === "ios" ? (
            <DateTimePicker
              value={time}
              mode="time"
              display="spinner"
              onChange={(_, d) => d && setTime(d)}
              textColor={colors.onSurface}
              themeVariant="dark"
              style={{ alignSelf: "center" }}
            />
          ) : (
            <>
              <Pressable
                onPress={() => setShowPicker(true)}
                style={styles.androidTimeBtn}
                testID="android-time-picker-button"
              >
                <Text style={styles.androidTimeText}>
                  {formatTime(time.getHours(), time.getMinutes(), lang)}
                </Text>
              </Pressable>
              {showPicker && (
                <DateTimePicker
                  value={time}
                  mode="time"
                  display="default"
                  onChange={(_, d) => {
                    setShowPicker(false);
                    if (d) setTime(d);
                  }}
                />
              )}
            </>
          )}
        </View>

        <Text style={styles.sectionLabel}>{t("repeat")}</Text>
        <View style={styles.daysRow}>
          {DAY_INDEXES.map((i) => {
            const d = WEEK_SHORT[lang][i];
            const on = days.includes(i);
            return (
              <Pressable
                key={i}
                onPress={() => toggleDay(i)}
                style={[styles.dayBtn, on && styles.dayBtnOn]}
                testID={`day-${i}`}
              >
                <Text style={[styles.dayBtnText, on && styles.dayBtnTextOn]}>
                  {d}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.sectionLabel}>{t("label")}</Text>
        <TextInput
          value={label}
          onChangeText={setLabel}
          placeholder={t("labelPlaceholder")}
          placeholderTextColor={colors.muted}
          style={styles.input}
          testID="label-input"
        />

        <Text style={styles.sectionLabel}>{t("alarmSound")}</Text>
        {SOUNDS.map((s) => {
          const selected = sound === s.key;
          return (
            <Pressable
              key={s.key}
              onPress={() => setSound(s.key)}
              style={[styles.soundRow, selected && styles.soundRowOn]}
              testID={`sound-${s.key}`}
            >
              <Text style={styles.soundEmoji}>{s.hindi}</Text>
              <Text style={styles.soundLabel}>{t(s.labelKey)}</Text>
              <View style={{ flex: 1 }} />
              {s.file ? (
                <Pressable
                  onPress={(e) => {
                    e.stopPropagation();
                    previewSound(s.key);
                  }}
                  style={styles.previewBtn}
                  testID={`preview-${s.key}`}
                >
                  <Feather name="play" size={14} color={colors.brandSecondary} />
                  <Text style={styles.previewText}>{t("preview")}</Text>
                </Pressable>
              ) : null}
              <Feather
                name={selected ? "check-circle" : "circle"}
                size={20}
                color={selected ? colors.brandSecondary : colors.muted}
                style={{ marginLeft: spacing.sm }}
              />
            </Pressable>
          );
        })}

        <View style={styles.note}>
          <Feather name="info" size={14} color={colors.muted} />
          <Text style={styles.noteText}>{t("alarmNote")}</Text>
        </View>
      </ScrollView>

      <View style={[styles.saveBar, { paddingBottom: insets.bottom + spacing.lg }]}>
        <Pressable
          onPress={save}
          disabled={saving}
          style={({ pressed }) => [
            styles.saveBtn,
            pressed && { opacity: 0.9 },
          ]}
          testID="save-alarm-button"
        >
          <LinearGradient
            colors={[colors.brandSecondary, colors.brandPrimary]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.saveInner}
          >
            {saving ? (
              <ActivityIndicator color={colors.onBrandSecondary} />
            ) : (
              <>
                <Feather name="bell" size={16} color={colors.onBrandSecondary} />
                <Text style={styles.saveText}>
                  {existing ? t("updateAlarm") : t("saveAlarm")}
                </Text>
              </>
            )}
          </LinearGradient>
        </Pressable>
      </View>
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
  title: {
    color: colors.onSurface,
    fontFamily: fonts.display,
    fontSize: 22,
  },
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
  sectionLabel: {
    color: colors.muted,
    fontSize: 11,
    letterSpacing: 1,
    textTransform: "uppercase",
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
    fontFamily: fonts.bodyMedium,
  },
  timeCard: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  androidTimeBtn: { padding: spacing.lg, alignItems: "center" },
  androidTimeText: {
    color: colors.onSurface,
    fontFamily: fonts.display,
    fontSize: 44,
  },
  daysRow: { flexDirection: "row", justifyContent: "space-between", gap: 6 },
  dayBtn: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    alignItems: "center",
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.border,
  },
  dayBtnOn: { backgroundColor: colors.brandPrimary, borderColor: colors.brandSecondary },
  dayBtnText: { color: colors.muted, fontFamily: fonts.bodyBold, fontSize: 12 },
  dayBtnTextOn: { color: colors.onBrandPrimary },
  input: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    color: colors.onSurface,
    fontSize: 15,
    fontFamily: fonts.body,
  },
  soundRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.md,
    marginBottom: spacing.sm,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  soundRowOn: {
    borderColor: colors.brandSecondary,
    backgroundColor: colors.brandTertiary,
  },
  soundEmoji: { fontSize: 20, color: colors.brandSecondary, fontFamily: fonts.display },
  soundLabel: { color: colors.onSurface, fontFamily: fonts.bodyMedium, fontSize: 14 },
  previewBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceTertiary,
  },
  previewText: {
    color: colors.brandSecondary,
    fontFamily: fonts.bodyMedium,
    fontSize: 11,
  },
  note: {
    marginTop: spacing.xl,
    flexDirection: "row",
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.border,
  },
  noteText: {
    flex: 1,
    color: colors.muted,
    fontSize: 12,
    lineHeight: 18,
    fontFamily: fonts.body,
  },
  saveBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: spacing.md,
    paddingHorizontal: spacing.xl,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  saveBtn: {
    borderRadius: radius.pill,
    overflow: "hidden",
  },
  saveInner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    paddingVertical: spacing.lg,
  },
  saveText: {
    color: colors.onBrandSecondary,
    fontFamily: fonts.bodyBold,
    fontSize: 15,
    letterSpacing: 0.5,
  },
});
