// Simple persisted store for user settings (location, default sound).
import { storage } from "@/src/utils/storage";

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
  const raw = await storage.getItem(KEY, null);
  if (typeof raw !== "string") return defaultSettings;
  try {
    return { ...defaultSettings, ...JSON.parse(raw) };
  } catch {
    return defaultSettings;
  }
}

export async function saveSettings(s: UserSettings): Promise<void> {
  // storage only accepts primitives, so the settings object is stored as a JSON string
  await storage.setItem(KEY, JSON.stringify(s));
}
