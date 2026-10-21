// Local-calendar date helpers (avoid UTC shifting the day before 5:30 AM IST).
export function toISODate(d: Date): string {
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

export function fromISODate(s: string, hour = 0, minute = 0): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d, hour, minute, 0, 0);
}

export function sunriseLabel(p: { sunrise?: string | null; sunrise_utc: string }): string {
  if (p.sunrise) return p.sunrise;
  return new Date(p.sunrise_utc).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}
