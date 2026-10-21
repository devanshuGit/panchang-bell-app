// Thin API client for the Panchang Alarm backend.
const BASE = process.env.EXPO_PUBLIC_BACKEND_URL + "/api";

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(BASE + path, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
  });
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  return res.json();
}

export type Panchang = {
  nakshatra_hindi: string;
  yoga_hindi?: string | null;
  festivals_hindi: string[];
  observances_hindi: string[];
  significance_hindi: string;
  masa: string;
  masa_hindi: string;
  festivals: string[];
  observances: string[];
  source: "online" | "calculated";
  sunrise?: string | null;
  sunset?: string | null;
  yoga?: string | null;
  karana?: string | null;
  rahu_kalam?: string | null;
  date: string;
  tithi: string;
  tithi_hindi: string;
  tithi_number: number;
  paksha: string;
  paksha_hindi: string;
  nakshatra: string;
  progress_pct: number;
  sunrise_utc: string;
  significance: string;
  is_fasting_day: boolean;
};

export type Alarm = {
  id: string;
  label: string;
  hour: number;
  minute: number;
  enabled: boolean;
  sound: string;
  days: number[];
  notification_id?: string | null;
  created_at: string;
};

export const api = {
  getPanchang: (lat: number, lng: number, date?: string) =>
    req<Panchang>(`/panchang?lat=${lat}&lng=${lng}${date ? `&date=${date}` : ""}`),
  getRange: (lat: number, lng: number, start: string, days: number) =>
    req<Panchang[]>(`/panchang/range?lat=${lat}&lng=${lng}&start=${start}&days=${days}`),
  getMonth: (lat: number, lng: number, year: number, month: number) =>
    req<Panchang[]>(`/panchang/month?lat=${lat}&lng=${lng}&year=${year}&month=${month}`),
  listAlarms: () => req<Alarm[]>("/alarms"),
  createAlarm: (data: Omit<Alarm, "id" | "created_at">) =>
    req<Alarm>("/alarms", { method: "POST", body: JSON.stringify(data) }),
  updateAlarm: (id: string, data: Partial<Omit<Alarm, "id" | "created_at">>) =>
    req<Alarm>(`/alarms/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteAlarm: (id: string) => req<{ ok: boolean }>(`/alarms/${id}`, { method: "DELETE" }),
  getSettings: () => req<Settings>("/settings"),
  putSettings: (s: Settings) =>
    req<Settings>("/settings", { method: "PUT", body: JSON.stringify(s) }),
};

export type Settings = {
  lat: number;
  lng: number;
  city: string;
  default_sound: string;
  use_device_location: boolean;
};
