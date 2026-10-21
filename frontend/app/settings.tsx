import { Feather } from "@react-native-vector-icons/feather";
import * as Location from "expo-location";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
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

import { defaultSettings, loadSettings, saveSettings, type UserSettings } from "@/src/settings-store";
import { cancelAll } from "@/src/notifications";
import { colors, fonts, radius, spacing } from "@/src/theme";

export default function Settings() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [s, setS] = useState<UserSettings>(defaultSettings);

  useEffect(() => {
    loadSettings().then(setS);
  }, []);

  const update = async (patch: Partial<UserSettings>) => {
    const next = { ...s, ...patch };
    setS(next);
    await saveSettings(next);
  };

  const useDeviceNow = async () => {
    if (Platform.OS === "web") return;
    const perm = await Location.requestForegroundPermissionsAsync();
    if (!perm.granted) return;
    const pos = await Location.getCurrentPositionAsync({});
    const places = await Location.reverseGeocodeAsync({
      latitude: pos.coords.latitude,
      longitude: pos.coords.longitude,
    });
    await update({
      lat: pos.coords.latitude,
      lng: pos.coords.longitude,
      city: places[0]?.city || places[0]?.region || "Current Location",
      useDeviceLocation: true,
    });
  };

  const useDelhi = async () =>
    update({ lat: 28.6139, lng: 77.209, city: "New Delhi", useDeviceLocation: false });

  return (
    <View style={styles.root} testID="settings-screen">
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <Pressable
          onPress={() => router.back()}
          style={styles.iconBtn}
          testID="settings-back-button"
        >
          <Feather name="arrow-left" size={20} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.title}>Settings</Text>
        <View style={styles.iconBtn} />
      </View>

      <ScrollView
        contentContainerStyle={{ padding: spacing.xl, paddingBottom: insets.bottom + spacing.xl }}
      >
        <Text style={styles.sectionLabel}>Location</Text>
        <View style={styles.card}>
          <View style={styles.rowBetween}>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>Current City</Text>
              <Text style={styles.rowSub}>{s.city}</Text>
            </View>
            <Feather name="map-pin" size={20} color={colors.brandSecondary} />
          </View>
          <View style={styles.rowBetween}>
            <Text style={styles.rowTitle}>Use device location</Text>
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
              <Text style={styles.outlineBtnText}>Detect Now</Text>
            </Pressable>
            <Pressable style={styles.outlineBtn} onPress={useDelhi} testID="use-delhi-btn">
              <Feather name="globe" size={14} color={colors.brandSecondary} />
              <Text style={styles.outlineBtnText}>Delhi (IST)</Text>
            </Pressable>
          </View>
          <View style={styles.coordsRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.inputLabel}>Latitude</Text>
              <TextInput
                keyboardType="numeric"
                value={String(s.lat)}
                onChangeText={(t) => update({ lat: parseFloat(t) || 0 })}
                style={styles.input}
                placeholderTextColor={colors.muted}
                testID="lat-input"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.inputLabel}>Longitude</Text>
              <TextInput
                keyboardType="numeric"
                value={String(s.lng)}
                onChangeText={(t) => update({ lng: parseFloat(t) || 0 })}
                style={styles.input}
                placeholderTextColor={colors.muted}
                testID="lng-input"
              />
            </View>
          </View>
        </View>

        <Text style={styles.sectionLabel}>Default Sound</Text>
        <View style={styles.card}>
          {[
            { k: "om", label: "Om Chant", icon: "ॐ" },
            { k: "bell", label: "Temple Bell", icon: "🔔" },
            { k: "default", label: "System Default", icon: "🔊" },
          ].map((o) => (
            <Pressable
              key={o.k}
              onPress={() => update({ defaultSound: o.k })}
              style={styles.soundItem}
              testID={`default-sound-${o.k}`}
            >
              <Text style={styles.soundIcon}>{o.icon}</Text>
              <Text style={styles.rowTitle}>{o.label}</Text>
              <View style={{ flex: 1 }} />
              <Feather
                name={s.defaultSound === o.k ? "check-circle" : "circle"}
                size={20}
                color={s.defaultSound === o.k ? colors.brandSecondary : colors.muted}
              />
            </Pressable>
          ))}
        </View>

        <Text style={styles.sectionLabel}>Danger Zone</Text>
        <Pressable
          onPress={async () => {
            await cancelAll();
          }}
          style={[styles.card, styles.destructive]}
          testID="cancel-all-notifs"
        >
          <Feather name="bell-off" size={18} color={colors.error} />
          <View>
            <Text style={[styles.rowTitle, { color: colors.error }]}>
              Cancel All Scheduled Alarms
            </Text>
            <Text style={styles.rowSub}>
              Clears pending notifications on this device. Alarm records remain.
            </Text>
          </View>
        </Pressable>

        <Text style={styles.footer}>ॐ शान्तिः शान्तिः शान्तिः</Text>
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
