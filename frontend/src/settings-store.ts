// Simple persisted store for user settings (location, default sound).
import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "panchang-settings-v1";

export type UserSettings = {
  lat: number;
  lng: number;
  city: string;
  defaultSound: string;
  useDeviceLocation: boolean;
};

export const defaultSettings: UserSettings = {
  lat: 28.6139,
  lng: 77.209,
  city: "New Delhi",
  defaultSound: "om",
  useDeviceLocation: true,
};

export async function loadSettings(): Promise<UserSettings> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return defaultSettings;
    return { ...defaultSettings, ...JSON.parse(raw) };
  } catch {
    return defaultSettings;
  }
}

export async function saveSettings(s: UserSettings): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(s));
}
