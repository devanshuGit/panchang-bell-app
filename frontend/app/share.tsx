import { Feather } from "@react-native-vector-icons/feather";
import { useQuery } from "@tanstack/react-query";
import * as Sharing from "expo-sharing";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Platform, Pressable, ScrollView, Share, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { captureRef } from "react-native-view-shot";

import { api, type Panchang } from "@/src/api";
import { fromISODate, sunriseLabel, toISODate } from "@/src/date";
import { defaultSettings, loadSettings } from "@/src/settings-store";
import { colors, fonts, radius, spacing } from "@/src/theme";

function shareText(p: Panchang, city: string) {
  const day = fromISODate(p.date).toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" });
  return [
    `ॐ आज की तिथि · Today's Tithi (${day})`,
    `${p.tithi_hindi} · ${p.paksha} ${p.tithi}`,
    `${p.masa_hindi} मास · ${p.masa}`,
    ...(p.festivals.length ? [`🪔 ${p.festivals.join(" · ")}`] : []),
    `Nakshatra: ${p.nakshatra} · Sunrise: ${sunriseLabel(p)} (${city})`,
    p.significance,
    "",
    "Sent with Tithi Alarm 🔔",
  ].join("\n");
}

export default function ShareScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const cardRef = useRef<View>(null);
  const [settings, setSettings] = useState(defaultSettings);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    loadSettings().then(setSettings);
  }, []);

  const today = toISODate(new Date());
  const q = useQuery({
    queryKey: ["panchang", settings.lat, settings.lng, today],
    queryFn: () => api.getPanchang(settings.lat, settings.lng, today),
  });
  const p = q.data;

  const shareImage = async () => {
    if (!p) return;
    setBusy(true);
    setStatus(null);
    try {
      if (Platform.OS === "web" || !(await Sharing.isAvailableAsync())) {
        await Share.share({ message: shareText(p, settings.city) });
        return;
      }
      const uri = await captureRef(cardRef, { format: "png", quality: 1, result: "tmpfile" });
      await Sharing.shareAsync(uri, { mimeType: "image/png", dialogTitle: "Share today's Tithi", UTI: "public.png" });
    } catch (e) {
      console.warn("share failed", e);
      setStatus("Couldn't share the image. Try sharing as text instead.");
    } finally {
      setBusy(false);
    }
  };

  const shareAsText = async () => {
    if (!p) return;
    try {
      await Share.share({ message: shareText(p, settings.city) });
    } catch {
      setStatus("Sharing was cancelled.");
    }
  };

  return (
    <View style={styles.root} testID="share-screen">
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <Pressable onPress={() => router.back()} style={styles.iconBtn} testID="share-close-button">
          <Feather name="x" size={20} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.title}>Share Today’s Tithi</Text>
        <View style={styles.iconBtn} />
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: insets.bottom + 180 }}>
        {!p ? (
          <ActivityIndicator color={colors.brandSecondary} style={{ marginTop: spacing["3xl"] }} />
        ) : (
          <View ref={cardRef} collapsable={false} style={styles.cardShell} testID="share-card">
            <LinearGradient
              colors={[colors.brandTertiary, colors.surfaceSecondary, colors.surface]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.card}
            >
              <Text style={styles.bigOm}>ॐ</Text>
              <Text style={styles.cardDate}>
                {fromISODate(p.date).toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
              </Text>
              <Text style={styles.cardKicker}>आज की तिथि · Today’s Tithi</Text>
              <Text style={styles.cardTithiHi}>{p.tithi_hindi}</Text>
              <Text style={styles.cardTithiEn}>{p.paksha} {p.tithi}</Text>
              <Text style={styles.cardMasa}>{p.paksha_hindi} · {p.masa_hindi} मास</Text>
              {p.festivals.length ? (
                <View style={styles.cardFestival}>
                  <Text style={styles.cardFestivalText}>🪔 {p.festivals.join(" · ")}</Text>
                </View>
              ) : null}
              <View style={styles.divider} />
              <Text style={styles.cardSig}>{p.significance}</Text>
              <View style={styles.cardMetaRow}>
                <Text style={styles.cardMeta}>✦ {p.nakshatra}</Text>
                <Text style={styles.cardMeta}>☀ {sunriseLabel(p)} · {settings.city}</Text>
              </View>
              <Text style={styles.brand}>Tithi Alarm 🔔</Text>
            </LinearGradient>
          </View>
        )}
      </ScrollView>

      <View style={[styles.bar, { paddingBottom: insets.bottom + spacing.lg }]}>
        {status ? <Text style={styles.status} testID="share-status">{status}</Text> : null}
        <Pressable onPress={shareImage} disabled={!p || busy} style={styles.primaryBtn} testID="share-image-button">
          <LinearGradient
            colors={[colors.brandSecondary, colors.brandPrimary]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.primaryInner}
          >
            {busy ? (
              <ActivityIndicator color={colors.onBrandSecondary} />
            ) : (
              <>
                <Feather name="image" size={16} color={colors.onBrandSecondary} />
                <Text style={styles.primaryText}>Share Card (WhatsApp, etc.)</Text>
              </>
            )}
          </LinearGradient>
        </Pressable>
        <Pressable onPress={shareAsText} disabled={!p} style={styles.secondaryBtn} testID="share-text-button">
          <Feather name="message-circle" size={16} color={colors.brandSecondary} />
          <Text style={styles.secondaryText}>Share as Text</Text>
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
  cardShell: { borderRadius: radius.lg, overflow: "hidden", borderWidth: 1, borderColor: colors.brandPrimary },
  card: { padding: spacing.xl, alignItems: "center" },
  bigOm: { color: colors.brandSecondary, fontFamily: fonts.display, fontSize: 64, lineHeight: 76 },
  cardDate: { color: colors.muted, fontFamily: fonts.body, fontSize: 12, marginTop: spacing.xs },
  cardKicker: { color: colors.brandSecondary, fontFamily: fonts.bodyMedium, fontSize: 12, letterSpacing: 1, marginTop: spacing.lg },
  cardTithiHi: { color: colors.onSurface, fontFamily: fonts.display, fontSize: 48, marginTop: spacing.sm },
  cardTithiEn: { color: colors.brandSecondary, fontFamily: fonts.display, fontSize: 22, fontStyle: "italic" },
  cardMasa: { color: colors.onSurfaceSecondary, fontFamily: fonts.body, fontSize: 13, marginTop: spacing.xs },
  cardFestival: {
    marginTop: spacing.md,
    backgroundColor: colors.brandSecondary,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  cardFestivalText: { color: colors.onBrandSecondary, fontFamily: fonts.bodyBold, fontSize: 14, textAlign: "center" },
  divider: { height: 1, alignSelf: "stretch", backgroundColor: colors.borderStrong, marginVertical: spacing.lg },
  cardSig: { color: colors.onSurfaceSecondary, fontFamily: fonts.body, fontSize: 14, lineHeight: 21, textAlign: "center" },
  cardMetaRow: { marginTop: spacing.lg, alignItems: "center", gap: 4 },
  cardMeta: { color: colors.muted, fontFamily: fonts.body, fontSize: 12 },
  brand: { color: colors.brandSecondary, fontFamily: fonts.display, fontSize: 14, marginTop: spacing.lg, opacity: 0.8 },
  bar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: spacing.md,
    paddingHorizontal: spacing.xl,
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  status: { color: colors.error, fontSize: 12, fontFamily: fonts.body, textAlign: "center" },
  primaryBtn: { borderRadius: radius.pill, overflow: "hidden" },
  primaryInner: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, paddingVertical: spacing.lg },
  primaryText: { color: colors.onBrandSecondary, fontFamily: fonts.bodyBold, fontSize: 15 },
  secondaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  secondaryText: { color: colors.brandSecondary, fontFamily: fonts.bodyMedium, fontSize: 14 },
});
