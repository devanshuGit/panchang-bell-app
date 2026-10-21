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
  getWeek: (lat: number, lng: number) => req<Panchang[]>(`/panchang/week?lat=${lat}&lng=${lng}`),
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
