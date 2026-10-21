import { Feather } from "@react-native-vector-icons/feather";
import * as Location from "expo-location";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import DateTimePicker from "@react-native-community/datetimepicker";

import { formatTime, type StringKey } from "@/src/i18n";
import { cancelAll } from "@/src/notifications";
import { useSettings } from "@/src/settings-context";
import { colors, fonts, radius, spacing } from "@/src/theme";

const EVENING_PRESETS = [18, 19, 20, 21];
const LANGS = [
  { k: "hi" as const, label: "हिन्दी" },
  { k: "en" as const, label: "English" },
];

export default function Settings() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { settings: s, update, lang, t } = useSettings();
  const [showPicker, setShowPicker] = useState(false);
  const [cleared, setCleared] = useState(false);
  const isPreset = s.eveningMinute === 0 && EVENING_PRESETS.includes(s.eveningHour);

  const useDeviceNow = async () => {
    if (Platform.OS === "web") return;
    const perm = await Location.requestForegroundPermissionsAsync();
    if (!perm.granted) return;
    const pos = await Location.getCurrentPositionAsync({});
    const places = await Location.reverseGeocodeAsync({
      latitude: pos.coords.latitude,
      longitude: pos.coords.longitude,
    });
    update({
      lat: pos.coords.latitude,
      lng: pos.coords.longitude,
      city: places[0]?.city || places[0]?.region || "Current Location",
      useDeviceLocation: true,
    });
  };

  const useDelhi = () =>
    update({ lat: 28.6139, lng: 77.209, city: "New Delhi", useDeviceLocation: false });

  const pickerValue = new Date();
  pickerValue.setHours(s.eveningHour, s.eveningMinute, 0, 0);

  return (
    <View style={styles.root} testID="settings-screen">
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <Pressable
          onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))}
          style={styles.iconBtn}
          testID="settings-back-button"
        >
          <Feather name="arrow-left" size={20} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.title}>{t("settings")}</Text>
        <View style={styles.iconBtn} />
      </View>

      <ScrollView
        contentContainerStyle={{ padding: spacing.xl, paddingBottom: insets.bottom + spacing.xl }}
      >
        <Text style={styles.sectionLabel}>{t("language")}</Text>
        <View style={styles.segment} testID="language-switch">
          {LANGS.map((o) => {
            const on = lang === o.k;
            return (
              <Pressable
                key={o.k}
                onPress={() => update({ language: o.k })}
                style={[styles.segmentBtn, on && styles.segmentBtnOn]}
                testID={`language-${o.k}`}
              >
                <Text style={[styles.segmentText, on && styles.segmentTextOn]}>{o.label}</Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.sectionLabel}>{t("location")}</Text>
        <View style={styles.card}>
          <View style={styles.rowBetween}>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>{t("currentCity")}</Text>
              <Text style={styles.rowSub}>{s.city}</Text>
            </View>
            <Feather name="map-pin" size={20} color={colors.brandSecondary} />
          </View>
          <View style={styles.rowBetween}>
            <Text style={styles.rowTitle}>{t("useDeviceLocation")}</Text>
            <Switch
              value={s.useDeviceLocation}
              onValueChange={(v) => update({ useDeviceLocation: v })}
              trackColor={{ false: colors.surfaceTertiary, true: colors.brandPrimary }}
              thumbColor={s.useDeviceLocation ? colors.brandSecondary : colors.muted}
              testID="use-device-location-toggle"
            />
          </View>
          <View style={styles.btnRow}>
            <Pressable style={styles.outlineBtn} onPress={useDeviceNow} testID="detect-location-btn">
              <Feather name="crosshair" size={14} color={colors.brandSecondary} />
              <Text style={styles.outlineBtnText}>{t("detectNow")}</Text>
            </Pressable>
            <Pressable style={styles.outlineBtn} onPress={useDelhi} testID="use-delhi-btn">
              <Feather name="globe" size={14} color={colors.brandSecondary} />
              <Text style={styles.outlineBtnText}>{t("delhi")}</Text>
            </Pressable>
          </View>
          <View style={styles.coordsRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.inputLabel}>{t("latitude")}</Text>
              <TextInput
                key={`lat-${s.city}`}
                keyboardType="numeric"
                defaultValue={String(s.lat)}
                onChangeText={(t) => update({ lat: parseFloat(t) || 0 })}
                style={styles.input}
                placeholderTextColor={colors.muted}
                testID="lat-input"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.inputLabel}>{t("longitude")}</Text>
              <TextInput
                key={`lng-${s.city}`}
                keyboardType="numeric"
                defaultValue={String(s.lng)}
                onChangeText={(t) => update({ lng: parseFloat(t) || 0 })}
                style={styles.input}
                placeholderTextColor={colors.muted}
                testID="lng-input"
              />
            </View>
          </View>
        </View>

        <Text style={styles.sectionLabel}>{t("eveningReminder")}</Text>
        <View style={styles.card} testID="evening-reminder-settings">
          <View style={styles.rowBetween}>
            <View style={{ flex: 1, paddingRight: spacing.md }}>
              <Text style={styles.rowTitle}>{t("eveningToggle")}</Text>
              <Text style={styles.rowSub}>{t("eveningHelp")}</Text>
            </View>
            <Switch
              value={s.eveningEnabled}
              onValueChange={(v) => update({ eveningEnabled: v })}
              trackColor={{ false: colors.surfaceTertiary, true: colors.brandPrimary }}
              thumbColor={s.eveningEnabled ? colors.brandSecondary : colors.muted}
              testID="evening-reminder-toggle"
            />
          </View>
          <View style={!s.eveningEnabled && { opacity: 0.5 }} pointerEvents={s.eveningEnabled ? "auto" : "none"}>
            <Text style={styles.inputLabel}>{t("reminderTime")}</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chipRow}
            >
              {EVENING_PRESETS.map((h) => {
                const on = isPreset && s.eveningHour === h;
                return (
                  <Pressable
                    key={h}
                    onPress={() => update({ eveningHour: h, eveningMinute: 0 })}
                    style={[styles.chip, on && styles.chipOn]}
                    testID={`evening-time-${h}`}
                  >
                    <Text style={[styles.chipText, on && styles.chipTextOn]}>{formatTime(h, 0, lang)}</Text>
                  </Pressable>
                );
              })}
              {Platform.OS !== "web" ? (
                <Pressable
                  onPress={() => setShowPicker((v) => !v)}
                  style={[styles.chip, !isPreset && styles.chipOn]}
                  testID="evening-time-custom"
                >
                  <Feather name="clock" size={12} color={!isPreset ? colors.onBrandSecondary : colors.brandSecondary} />
                  <Text style={[styles.chipText, !isPreset && styles.chipTextOn]}>
                    {isPreset ? t("custom") : formatTime(s.eveningHour, s.eveningMinute, lang)}
                  </Text>
                </Pressable>
              ) : null}
            </ScrollView>
            {showPicker ? (
              <DateTimePicker
                value={pickerValue}
                mode="time"
                display={Platform.OS === "ios" ? "spinner" : "default"}
                themeVariant="dark"
                textColor={colors.onSurface}
                onChange={(e, d) => {
                  if (Platform.OS !== "ios") setShowPicker(false);
                  if (d && e.type !== "dismissed") update({ eveningHour: d.getHours(), eveningMinute: d.getMinutes() });
                }}
              />
            ) : null}
          </View>
        </View>

        <Text style={styles.sectionLabel}>{t("defaultSound")}</Text>
        <View style={styles.card}>
          {(
            [
              { k: "om", labelKey: "soundOm", icon: "ॐ" },
              { k: "bell", labelKey: "soundBell", icon: "🔔" },
              { k: "default", labelKey: "soundDefault", icon: "🔊" },
            ] as { k: string; labelKey: StringKey; icon: string }[]
          ).map((o) => (
            <Pressable
              key={o.k}
              onPress={() => update({ defaultSound: o.k })}
              style={styles.soundItem}
              testID={`default-sound-${o.k}`}
            >
              <Text style={styles.soundIcon}>{o.icon}</Text>
              <Text style={styles.rowTitle}>{t(o.labelKey)}</Text>
              <View style={{ flex: 1 }} />
              <Feather
                name={s.defaultSound === o.k ? "check-circle" : "circle"}
                size={20}
                color={s.defaultSound === o.k ? colors.brandSecondary : colors.muted}
              />
            </Pressable>
          ))}
        </View>

        <Text style={styles.sectionLabel}>{t("dangerZone")}</Text>
        <Pressable
          onPress={async () => {
            await cancelAll();
            setCleared(true);
          }}
          style={[styles.card, styles.destructive]}
          testID="cancel-all-notifs"
        >
          <Feather name="bell-off" size={18} color={colors.error} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.rowTitle, { color: colors.error }]}>{t("cancelAll")}</Text>
            <Text style={styles.rowSub}>{cleared ? t("cancelledAll") : t("cancelAllSub")}</Text>
          </View>
        </Pressable>

        <Text style={styles.sectionLabel}>{t("credits")}</Text>
        <View style={styles.card} testID="credits-section">
          <View style={{ gap: spacing.sm }}>
            <Text style={styles.creditText} testID="credit-om">{t("omCredit")}</Text>
            <View style={styles.btnRow}>
              <Pressable
                style={styles.outlineBtn}
                onPress={() => Linking.openURL("https://commons.wikimedia.org/wiki/File:Om_pro.ogg")}
                testID="credit-om-source"
              >
                <Feather name="external-link" size={14} color={colors.brandSecondary} />
                <Text style={styles.outlineBtnText}>{t("viewSource")}</Text>
              </Pressable>
              <Pressable
                style={styles.outlineBtn}
                onPress={() => Linking.openURL("https://creativecommons.org/licenses/by-sa/3.0/")}
                testID="credit-om-license"
              >
                <Feather name="file-text" size={14} color={colors.brandSecondary} />
                <Text style={styles.outlineBtnText}>{t("viewLicense")}</Text>
              </Pressable>
            </View>
          </View>
          <Text style={styles.creditText}>{t("bellCredit")}</Text>
          <Text style={styles.creditText}>{t("panchangCredit")}</Text>
          <Text style={styles.creditText}>{t("kathaCredit")}</Text>
        </View>

        <Text style={styles.footer}>ॐ शान्तिः शान्तिः शान्तिः</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  creditText: { color: colors.onSurfaceSecondary, fontFamily: fonts.body, fontSize: 12, lineHeight: 18 },
  segment: {
    flexDirection: "row",
    padding: spacing.xs,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.border,
  },
  segmentBtn: { flex: 1, paddingVertical: spacing.md, borderRadius: radius.pill, alignItems: "center" },
  segmentBtnOn: { backgroundColor: colors.brandSecondary },
  segmentText: { color: colors.onSurfaceSecondary, fontFamily: fonts.bodyMedium, fontSize: 15 },
  segmentTextOn: { color: colors.onBrandSecondary },
  chipRow: { gap: spacing.sm, paddingVertical: spacing.xs },
  chip: {
    flexShrink: 0,
    height: 36,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surfaceTertiary,
  },
  chipOn: { backgroundColor: colors.brandSecondary, borderColor: colors.brandSecondary },
  chipText: { color: colors.brandSecondary, fontFamily: fonts.bodyMedium, fontSize: 13 },
  chipTextOn: { color: colors.onBrandSecondary },
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
  sectionLabel: {
    color: colors.muted,
    fontSize: 11,
    letterSpacing: 1,
    textTransform: "uppercase",
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
    fontFamily: fonts.bodyMedium,
  },
  card: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.lg,
  },
  rowBetween: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  rowTitle: { color: colors.onSurface, fontFamily: fonts.bodyMedium, fontSize: 14 },
  rowSub: { color: colors.muted, fontFamily: fonts.body, fontSize: 12, marginTop: 2 },
  btnRow: { flexDirection: "row", gap: spacing.sm },
  outlineBtn: {
    flex: 1,
    flexDirection: "row",
    gap: 6,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surfaceTertiary,
  },
  outlineBtnText: {
    color: colors.brandSecondary,
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
  },
  coordsRow: { flexDirection: "row", gap: spacing.md },
  inputLabel: {
    color: colors.muted,
    fontSize: 11,
    marginBottom: 4,
    fontFamily: fonts.body,
  },
  input: {
    backgroundColor: colors.surfaceTertiary,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    color: colors.onSurface,
    fontFamily: fonts.body,
    fontSize: 13,
  },
  soundItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  soundIcon: {
    color: colors.brandSecondary,
    fontSize: 20,
    fontFamily: fonts.display,
    width: 28,
    textAlign: "center",
  },
  destructive: {
    flexDirection: "row",
    gap: spacing.md,
    alignItems: "center",
    borderColor: "rgba(239,68,68,0.4)",
  },
  footer: {
    textAlign: "center",
    color: colors.brandSecondary,
    fontFamily: fonts.display,
    fontSize: 16,
    marginTop: spacing["2xl"],
    opacity: 0.6,
  },
});
