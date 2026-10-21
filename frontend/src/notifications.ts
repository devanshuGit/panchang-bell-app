// Local notification scheduling for daily tithi alarms.
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

import type { Alarm, Panchang } from "@/src/api";
import { fromISODate } from "@/src/date";
import { lp, translate, type Lang } from "@/src/i18n";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function ensureNotificationPermission(): Promise<boolean> {
  if (Platform.OS === "web") return false;
  const existing = await Notifications.getPermissionsAsync();
  if (existing.granted) return true;
  const req = await Notifications.requestPermissionsAsync();
  return req.granted;
}

// Bundled sounds (registered via the expo-notifications plugin in app.json).
// Android binds sound to a channel, so each sound gets its own channel.
const SOUND_FILES: Record<string, string | undefined> = { om: "om.wav", bell: "bell.wav" };
const channelFor = (sound: string) => `tithi-${SOUND_FILES[sound] ? sound : "default"}`;

export async function ensureChannel() {
  if (Platform.OS !== "android") return;
  for (const sound of ["om", "bell", "default"]) {
    await Notifications.setNotificationChannelAsync(channelFor(sound), {
      name: sound === "om" ? "Om Chant" : sound === "bell" ? "Temple Bell" : "Tithi (default sound)",
      importance: Notifications.AndroidImportance.MAX,
      sound: SOUND_FILES[sound] ?? "default",
      vibrationPattern: [0, 300, 200, 300],
      lightColor: "#D97706",
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    });
  }
}

const MAX_PENDING = 60; // iOS keeps at most 64 pending local notifications
const EVENING_TITHIS = new Set(["Ekadashi", "Purnima", "Amavasya"]);

type SyncOptions = {
  lang: Lang;
  evening: { enabled: boolean; hour: number; minute: number; sound: string };
};

/**
 * Reschedules every reminder as one dated notification per day, so each one
 * names that day's actual Tithi:
 *  - morning alarms on the user's chosen days
 *  - an evening-before reminder ahead of festivals, Ekadashi, Purnima and Amavasya
 * Call whenever alarms, settings or the upcoming Panchang change (Home does this).
 */
export async function syncAlarmSchedules(alarms: Alarm[], upcoming: Panchang[], opts: SyncOptions) {
  if (Platform.OS === "web") return;
  const perm = await Notifications.getPermissionsAsync();
  await cancelAll();
  if (!perm.granted) return;
  await ensureChannel();
  const { lang } = opts;
  const now = Date.now();
  let budget = MAX_PENDING;

  // Evening-before reminders first: they are few (~6 a month) and time-critical.
  if (opts.evening.enabled) {
    for (const p of upcoming) {
      if (budget <= 0) break;
      if (!p.festivals.length && !EVENING_TITHIS.has(p.tithi)) continue;
      const when = fromISODate(p.date, opts.evening.hour, opts.evening.minute);
      when.setDate(when.getDate() - 1);
      if (when.getTime() <= now) continue;
      const l = lp(p, lang);
      const headline = l.festivals[0] ?? l.tithi;
      await Notifications.scheduleNotificationAsync({
        identifier: `evening-${p.date}`,
        content: {
          title: `🪔 ${translate(lang, "tomorrow")}: ${headline}`,
          body: `${l.tithiFull}, ${l.masa}. ${l.significance} ${translate(lang, "prepare")}`,
          sound: SOUND_FILES[opts.evening.sound] ?? "default",
          data: { date: p.date, type: "evening-before" },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: when,
          channelId: channelFor(opts.evening.sound),
        },
      });
      budget--;
    }
  }

  const enabled = alarms.filter((a) => a.enabled && a.days.length > 0);
  if (!enabled.length) return;
  const perAlarm = Math.floor(budget / enabled.length);

  for (const alarm of enabled) {
    let count = 0;
    for (const p of upcoming) {
      if (count >= perAlarm) break;
      const when = fromISODate(p.date, alarm.hour, alarm.minute);
      if (when.getTime() <= now || !alarm.days.includes(when.getDay())) continue;
      const l = lp(p, lang);
      const highlight = l.festivals[0] ?? l.observances[0];
      await Notifications.scheduleNotificationAsync({
        identifier: `${alarm.id}-${p.date}`,
        content: {
          title: `ॐ ${p.tithi_hindi} · ${lang === "hi" ? l.paksha : p.tithi}`,
          body: `${l.paksha}, ${l.masa}${highlight ? ` · ${highlight}` : ""}. ${l.significance}`,
          sound: SOUND_FILES[alarm.sound] ?? "default",
          data: { alarmId: alarm.id, date: p.date, type: "tithi-alarm" },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: when,
          channelId: channelFor(alarm.sound),
        },
      });
      count++;
    }
  }
}

export async function cancelAll() {
  if (Platform.OS === "web") return;
  await Notifications.cancelAllScheduledNotificationsAsync();
}
