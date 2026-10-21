// Local notification scheduling for daily tithi alarms.
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

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

export async function ensureChannel() {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync("tithi-alarm", {
    name: "Tithi Alarm",
    importance: Notifications.AndroidImportance.HIGH,
    sound: "default",
    vibrationPattern: [0, 300, 200, 300],
    lightColor: "#D97706",
  });
}

export async function scheduleDailyTithi(
  hour: number,
  minute: number,
  label: string,
  alarmId: string,
): Promise<string | null> {
  if (Platform.OS === "web") return null;
  await ensureChannel();
  const id = await Notifications.scheduleNotificationAsync({
    identifier: alarmId,
    content: {
      title: label || "Today's Tithi",
      body: "Tap to view today's Tithi, Paksha and spiritual significance.",
      sound: "default",
      data: { alarmId, type: "tithi-alarm" },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
      hour,
      minute,
      repeats: true,
      channelId: "tithi-alarm",
    } as any,
  });
  return id;
}

export async function cancelNotification(id?: string | null) {
  if (!id || Platform.OS === "web") return;
  try {
    await Notifications.cancelScheduledNotificationAsync(id);
  } catch {}
}

export async function cancelAll() {
  if (Platform.OS === "web") return;
  await Notifications.cancelAllScheduledNotificationsAsync();
}
