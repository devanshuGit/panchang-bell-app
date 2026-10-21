import { Feather } from "@react-native-vector-icons/feather";
import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Share, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api";
import { useSettings } from "@/src/settings-context";
import { hasVoice, speak, stopSpeaking, type SpeakLang } from "@/src/speech";
import { colors, fonts, radius, spacing } from "@/src/theme";

const SIZES = [16, 19, 23];
const RATES = { slow: 0.75, normal: 0.95 };

export default function KathaScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { lang, t } = useSettings();
  const [sizeIdx, setSizeIdx] = useState(1);
  const q = useQuery({ queryKey: ["katha", id], queryFn: () => api.getKatha(id), enabled: !!id });
  const k = q.data;
  const hi = lang === "hi";
  const size = SIZES[sizeIdx];
  const [speaking, setSpeaking] = useState(false);
  const [speakLang, setSpeakLang] = useState<SpeakLang>("hi");
  const [rate, setRate] = useState<keyof typeof RATES>("slow");
  const [hindiOk, setHindiOk] = useState(true);

  useEffect(() => {
    hasVoice("hi").then(setHindiOk);
    return () => stopSpeaking();
  }, []);

  const toggleListen = () => {
    if (!k) return;
    if (speaking) {
      stopSpeaking();
      setSpeaking(false);
      return;
    }
    const sh = speakLang === "hi";
    const text = sh
      ? `${k.title_hindi}। व्रत विधि। ${k.vidhi_hindi} कथा। ${k.story_hindi}`
      : `${k.title}. How to observe. ${k.vidhi} The story. ${k.story}`;
    setSpeaking(true);
    speak(text, speakLang, RATES[rate], () => setSpeaking(false));
  };

  const changeSpeech = (fn: () => void) => {
    stopSpeaking();
    setSpeaking(false);
    fn();
  };

  const share = async () => {
    if (!k) return;
    const title = hi ? k.title_hindi : k.title;
    try {
      await Share.share({
        message: `ॐ ${title}\n\n${hi ? k.story_hindi : k.story}\n\n${t("howToObserve")}: ${hi ? k.vidhi_hindi : k.vidhi}\n\n${t("sentWith")}`,
      });
    } catch {}
  };

  return (
    <View style={styles.root} testID="katha-screen">
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <Pressable
          onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))}
          style={styles.iconBtn}
          testID="katha-back-button"
        >
          <Feather name="arrow-left" size={20} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.headerTitle}>{t("vratKatha")}</Text>
        <Pressable onPress={share} style={styles.iconBtn} disabled={!k} testID="katha-share-button">
          <Feather name="share-2" size={18} color={colors.onSurface} />
        </Pressable>
      </View>

      {q.isLoading ? (
        <ActivityIndicator color={colors.brandSecondary} style={{ marginTop: spacing["3xl"] }} />
      ) : !k ? (
        <Pressable onPress={() => q.refetch()} style={styles.error} testID="katha-error">
          <Feather name="refresh-cw" size={18} color={colors.error} />
          <Text style={styles.muted}>{t("kathaNotFound")}</Text>
        </Pressable>
      ) : (
        <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: insets.bottom + spacing["2xl"] }}>
          <Text style={styles.om}>ॐ</Text>
          <Text style={styles.title} testID="katha-title">{hi ? k.title_hindi : k.title}</Text>
          {!hi ? <Text style={styles.subtitle}>{k.title_hindi}</Text> : null}

          <View style={styles.sizeRow}>
            <Text style={styles.muted}>{t("textSize")}</Text>
            {SIZES.map((s, i) => (
              <Pressable
                key={s}
                onPress={() => setSizeIdx(i)}
                style={[styles.sizeBtn, i === sizeIdx && styles.sizeBtnOn]}
                testID={`katha-size-${i}`}
              >
                <Text style={[styles.sizeText, { fontSize: 12 + i * 3 }, i === sizeIdx && styles.sizeTextOn]}>A</Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.listenCard} testID="katha-listen-card">
            <Pressable onPress={toggleListen} style={styles.listenBtn} testID="katha-listen-button">
              <Feather name={speaking ? "square" : "volume-2"} size={18} color={colors.onBrandSecondary} />
              <Text style={styles.listenText}>{speaking ? t("stop") : t("listen")}</Text>
            </Pressable>
            <View style={styles.listenOpts}>
              <Text style={styles.muted}>{t("readIn")}</Text>
              {(["hi", "en"] as const).map((l) => (
                <Pressable
                  key={l}
                  onPress={() => changeSpeech(() => setSpeakLang(l))}
                  style={[styles.optChip, speakLang === l && styles.optChipOn]}
                  testID={`katha-voice-${l}`}
                >
                  <Text style={[styles.optText, speakLang === l && styles.optTextOn]}>{l === "hi" ? "हिन्दी" : "English"}</Text>
                </Pressable>
              ))}
            </View>
            <View style={styles.listenOpts}>
              <Text style={styles.muted}>{t("speed")}</Text>
              {(["slow", "normal"] as const).map((r) => (
                <Pressable
                  key={r}
                  onPress={() => changeSpeech(() => setRate(r))}
                  style={[styles.optChip, rate === r && styles.optChipOn]}
                  testID={`katha-speed-${r}`}
                >
                  <Text style={[styles.optText, rate === r && styles.optTextOn]}>{t(r)}</Text>
                </Pressable>
              ))}
            </View>
            {speakLang === "hi" && !hindiOk ? (
              <Text style={styles.voiceWarn} testID="katha-no-hindi-voice">{t("noHindiVoice")}</Text>
            ) : null}
          </View>

          {(hi ? k.vidhi_hindi : k.vidhi) ? (
            <View style={styles.vidhi} testID="katha-vidhi">
              <View style={styles.vidhiHead}>
                <Feather name="list" size={14} color={colors.brandSecondary} />
                <Text style={styles.vidhiTitle}>{t("howToObserve")}</Text>
              </View>
              <Text style={[styles.vidhiText, { fontSize: size - 2, lineHeight: (size - 2) * 1.55 }]}>
                {hi ? k.vidhi_hindi : k.vidhi}
              </Text>
            </View>
          ) : null}

          <Text style={styles.sectionTitle}>{t("katha")}</Text>
          <Text style={[styles.story, { fontSize: size, lineHeight: size * 1.65 }]} testID="katha-story">
            {hi ? k.story_hindi : k.story}
          </Text>
          <Text style={styles.closing}>॥ {hi ? "बोलो श्री हरि भगवान की जय" : "Jai Shri Hari"} ॥</Text>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  listenCard: {
    marginTop: spacing.lg,
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.md,
  },
  listenBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    minHeight: 48,
    borderRadius: radius.pill,
    backgroundColor: colors.brandSecondary,
  },
  listenText: { color: colors.onBrandSecondary, fontFamily: fonts.bodyBold, fontSize: 16 },
  listenOpts: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  optChip: {
    flexShrink: 0,
    height: 36,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    justifyContent: "center",
  },
  optChipOn: { backgroundColor: colors.brandTertiary, borderColor: colors.brandSecondary },
  optText: { color: colors.muted, fontFamily: fonts.bodyMedium, fontSize: 13 },
  optTextOn: { color: colors.brandSecondary },
  voiceWarn: { color: colors.warning, fontFamily: fonts.body, fontSize: 12, lineHeight: 17 },
  root: { flex: 1, backgroundColor: colors.surface },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.md,
  },
  headerTitle: { color: colors.onSurface, fontFamily: fonts.display, fontSize: 22 },
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
  error: { alignItems: "center", gap: spacing.sm, padding: spacing["3xl"] },
  om: { color: colors.brandSecondary, fontFamily: fonts.display, fontSize: 44, textAlign: "center" },
  title: { color: colors.onSurface, fontFamily: fonts.display, fontSize: 28, textAlign: "center", marginTop: spacing.sm },
  subtitle: { color: colors.brandSecondary, fontFamily: fonts.display, fontSize: 18, textAlign: "center", marginTop: 2 },
  sizeRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, marginTop: spacing.lg },
  sizeBtn: {
    width: 44,
    height: 36,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sizeBtnOn: { borderColor: colors.brandSecondary, backgroundColor: colors.brandTertiary },
  sizeText: { color: colors.muted, fontFamily: fonts.bodyBold },
  sizeTextOn: { color: colors.brandSecondary },
  vidhi: {
    marginTop: spacing.xl,
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    gap: spacing.sm,
  },
  vidhiHead: { flexDirection: "row", alignItems: "center", gap: 6 },
  vidhiTitle: { color: colors.brandSecondary, fontFamily: fonts.bodyBold, fontSize: 13, letterSpacing: 0.5 },
  vidhiText: { color: colors.onSurfaceSecondary, fontFamily: fonts.body },
  sectionTitle: { color: colors.brandSecondary, fontFamily: fonts.display, fontSize: 20, marginTop: spacing.xl, marginBottom: spacing.sm },
  story: { color: colors.onSurface, fontFamily: fonts.display },
  closing: { color: colors.brandSecondary, fontFamily: fonts.display, fontSize: 15, textAlign: "center", marginTop: spacing.xl, opacity: 0.8 },
  muted: { color: colors.muted, fontSize: 12, fontFamily: fonts.body },
});
