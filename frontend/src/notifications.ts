// Local notification scheduling for daily tithi alarms.
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

import type { Alarm, Panchang } from "@/src/api";
import { fromISODate } from "@/src/date";

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

/**
 * Reschedules every alarm as one dated notification per upcoming day, so each
 * reminder announces that day's actual Tithi. Call whenever alarms or the
 * upcoming Panchang change (the home screen does this on every load).
 */
export async function syncAlarmSchedules(alarms: Alarm[], upcoming: Panchang[]) {
  if (Platform.OS === "web") return;
  const perm = await Notifications.getPermissionsAsync();
  await cancelAll();
  if (!perm.granted) return;
  await ensureChannel();
  const enabled = alarms.filter((a) => a.enabled && a.days.length > 0);
  if (!enabled.length) return;
  const perAlarm = Math.floor(MAX_PENDING / enabled.length);
  const now = Date.now();

  for (const alarm of enabled) {
    let count = 0;
    for (const p of upcoming) {
      if (count >= perAlarm) break;
      const when = fromISODate(p.date, alarm.hour, alarm.minute);
      if (when.getTime() <= now || !alarm.days.includes(when.getDay())) continue;
      const highlight = p.festivals[0] ?? p.observances[0];
      await Notifications.scheduleNotificationAsync({
        identifier: `${alarm.id}-${p.date}`,
        content: {
          title: `ॐ ${p.tithi_hindi} · ${p.tithi}`,
          body: `${p.paksha} Paksha, ${p.masa}${highlight ? ` · ${highlight}` : ""}. ${p.significance}`,
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
