// Simple persisted store for user settings (location, default sound).
import { storage } from "@/src/utils/storage";

const KEY = "panchang-settings-v1";

export type UserSettings = {
  lat: number;
  lng: number;
  city: string;
  defaultSound: string;
  useDeviceLocation: boolean;
  language: "en" | "hi" | null; // null = follow the phone's language
  eveningEnabled: boolean;
  eveningHour: number;
  eveningMinute: number;
};

export const defaultSettings: UserSettings = {
  lat: 28.6139,
  lng: 77.209,
  city: "New Delhi",
  defaultSound: "om",
  useDeviceLocation: true,
  language: null,
  eveningEnabled: true,
  eveningHour: 19,
  eveningMinute: 0,
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
